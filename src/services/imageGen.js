const defaultEndpoint = 'https://api.bfl.ml/v1/flux-pro-1.1';
const maxAttempts = 3;
const defaultCostPerImage = 0.04;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Generates one Flux image for a scene.
 *
 * @param {{ visualPrompt: string }} scene
 * @param {{
 *   apiKey?: string,
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   sleep?: (milliseconds: number) => Promise<void>,
 *   costPerImage?: number
 * }} options
 * @returns {Promise<{url: string, cost: number}>}
 */
export async function generateSceneImage(
  scene,
  {
    apiKey = process.env.FLUX_API_KEY,
    endpoint = process.env.FLUX_API_URL || defaultEndpoint,
    fetchImpl = fetch,
    timeoutMs = 30000,
    sleep = wait,
    costPerImage = Number(process.env.FLUX_COST_PER_IMAGE) || defaultCostPerImage,
  } = {},
) {
  if (!scene?.visualPrompt?.trim()) throw new Error('A visual prompt is required');
  if (!apiKey) throw new Error('FLUX_API_KEY is not configured');

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: scene.visualPrompt, width: 1080, height: 1920 }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Flux image generation failed with status ${response.status}`);
        if (response.status !== 429 && response.status < 500) throw error;
        lastError = error;
      } else {
        const payload = await response.json();
        const url = payload.url || payload.image_url || payload.result?.sample;
        if (!url) throw new Error('Flux response did not contain an image URL');
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
    storyboard.push({ ...scene, imageUrl: image.url });
    cost += image.cost;
  }
  return { storyboard, cost };
}
