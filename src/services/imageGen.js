import fs from 'fs';
import path from 'path';
import { storyboardKeyboard } from '../bot/keyboards.js';

const defaultCloudflareModel = '@cf/black-forest-labs/flux-1-schnell';
const defaultEndpoint = 'https://api.bfl.ml/v1/flux-pro-1.1';
const maxAttempts = 3;
const defaultCostPerImage = 0.003; // Cloudflare Workers AI Flux typical cost per image

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Ensures the local media storage directory exists and writes image buffer to disk.
 *
 * @param {Buffer|ArrayBuffer} buffer
 * @param {string} filename
 * @param {string} [storageDir]
 * @returns {string} Local file path or served URL
 */
export function saveImageLocally(buffer, filename, storageDir = process.env.IMAGE_STORAGE_DIR || './media/images') {
  const resolvedDir = path.resolve(storageDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  const filePath = path.join(resolvedDir, filename);
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  fs.writeFileSync(filePath, data);
  return filePath;
}

/**
 * Generates one Flux image for a scene using Cloudflare Workers AI Flux or Flux REST API.
 * Saves generated images locally and returns durable URLs with tracked cost.
 *
 * @param {{ visualPrompt: string, sceneNo?: number }} scene
 * @param {{
 *   apiKey?: string,
 *   apiToken?: string,
 *   accountId?: string,
 *   model?: string,
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   sleep?: (milliseconds: number) => Promise<void>,
 *   costPerImage?: number,
 *   storageDir?: string
 * }} options
 * @returns {Promise<{url: string, cost: number, filePath?: string}>}
 */
export async function generateSceneImage(
  scene,
  {
    apiKey = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || process.env.FLUX_API_KEY,
    apiToken = process.env.CLOUDFLARE_API_TOKEN,
    accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
    model = process.env.CLOUDFLARE_FLUX_MODEL || defaultCloudflareModel,
    endpoint,
    fetchImpl = fetch,
    timeoutMs = 30000,
    sleep = wait,
    costPerImage = Number(process.env.FLUX_COST_PER_IMAGE) || defaultCostPerImage,
    storageDir = process.env.IMAGE_STORAGE_DIR || './media/images',
  } = {},
) {
  if (!scene?.visualPrompt?.trim()) throw new Error('A visual prompt is required');
  const token = apiToken || apiKey;
  if (!token) throw new Error('FLUX_API_KEY is not configured');

  // Build target endpoint: Cloudflare Workers AI if accountId provided, otherwise generic Flux endpoint
  let targetUrl = endpoint || process.env.FLUX_API_URL;
  if (!targetUrl) {
    if (accountId) {
      targetUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    } else {
      targetUrl = defaultEndpoint;
    }
  }

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const isCloudflare = targetUrl.includes('cloudflare.com') || !!accountId;
      const isBfl = targetUrl.includes('bfl.ml');
      const requestBody = isCloudflare
        ? { prompt: scene.visualPrompt, num_steps: 4, width: 1080, height: 1920 }
        : { prompt: scene.visualPrompt, width: isBfl ? 1088 : 1080, height: 1920 };

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      if (isBfl || token.startsWith('bfl_')) {
        headers['x-key'] = token;
      }

      const response = await fetchImpl(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`Flux image generation failed with status ${response.status}`);
        if (response.status !== 429 && response.status < 500) throw error;
        lastError = error;
      } else {
        const contentType = response.headers?.get?.('content-type') || '';

        // Case 1: Binary image response directly from Cloudflare Workers AI
        if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
          const arrayBuffer = await response.arrayBuffer();
          const filename = `scene-${scene.sceneNo || Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
          const filePath = saveImageLocally(arrayBuffer, filename, storageDir);
          return { url: filePath, filePath, cost: costPerImage };
        }

        // Case 2: JSON payload response with URL or base64 or BFL async task
        let payload = await response.json();

        // If BFL async task returned (e.g. { id: '...' })
        if (payload.id && !payload.url && !payload.result?.sample && (isBfl || payload.status === 'Pending')) {
          const pollUrl = payload.polling_url || `https://api.bfl.ml/v1/get_result?id=${payload.id}`;
          const pollStart = Date.now();
          while (Date.now() - pollStart < timeoutMs) {
            await sleep(1000);
            const pollRes = await fetchImpl(pollUrl, {
              headers: { 'x-key': token, Authorization: `Bearer ${token}` },
            });
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData.status === 'Ready' && pollData.result?.sample) {
                payload = pollData;
                break;
              }
              if (pollData.status === 'Error' || pollData.status === 'Task not found') {
                throw new Error(`BFL task failed with status ${pollData.status}`);
              }
            }
          }
        }

        const base64Data = payload.result?.image || payload.image || payload.result?.base64;
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `scene-${scene.sceneNo || Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
          const filePath = saveImageLocally(buffer, filename, storageDir);
          return { url: filePath, filePath, cost: costPerImage };
        }

        const url = payload.url || payload.image_url || payload.result?.sample || payload.result?.url;
        if (!url) throw new Error('Flux response did not contain an image URL or image data');
        return { url, cost: costPerImage };
      }
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('Flux image generation timed out') : error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < maxAttempts - 1) await sleep(250 * 2 ** attempt);
  }

  throw new Error(`Flux image generation failed after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Generates storyboard images sequentially so failures identify one scene clearly.
 * Tracks total accumulated cost.
 *
 * @param {object[]} scenes
 * @param {Parameters<typeof generateSceneImage>[1]} options
 * @returns {Promise<{storyboard: object[], cost: number}>}
 */
export async function generateStoryboardImages(scenes, options = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('At least one storyboard scene is required');
  }

  const storyboard = [];
  let cost = 0;
  for (const scene of scenes) {
    const image = await generateSceneImage(scene, options);
    storyboard.push({ ...scene, imageUrl: image.url, imagePath: image.filePath });
    cost += image.cost;
  }
  return { storyboard, cost: Number(cost.toFixed(4)) };
}

/**
 * Sends storyboard scenes as a Telegram photo album with review keyboard.
 *
 * @param {object} ctx GrammY context
 * @param {object} job
 * @returns {Promise<void>}
 */
export async function sendStoryboardAlbum(ctx, job) {
  if (!job.storyboard?.length) return;
  const media = job.storyboard.map((scene) => ({
    type: 'photo',
    media: scene.imageUrl || scene.imagePath,
    caption: `Scene ${scene.sceneNo || scene.scene}: ${scene.narration}`,
  }));
  await ctx.api.sendMediaGroup(ctx.chat.id, media);
  await ctx.reply(
    `🎨 Storyboard visual draft generated (${job.storyboard.length} scenes, estimated cost: $${(job.costEstimate || 0).toFixed(4)}).\n\nReview above scenes. Approve to start audio & video rendering or regenerate individual scenes:`,
    {
      reply_markup: storyboardKeyboard(String(job._id), job.storyboard),
    },
  );
}
