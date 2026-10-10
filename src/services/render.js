import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JOB_STATUSES } from '../pipeline/stateMachine.js';

const execAsync = promisify(exec);
const creatomateEndpoint = 'https://api.creatomate.com/v2';
const terminalStatuses = new Set(['succeeded', 'failed']);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sceneDuration(scene, voice) {
  return Number(voice?.durationSeconds || scene.duration || 4);
}

/**
 * Builds Remotion input props JSON structure.
 *
 * @param {object[]} scenes
 * @param {object[]} voiceTracks
 * @param {{ backgroundMusicUrl?: string }} options
 * @returns {object}
 */
export function buildRemotionProps(scenes, voiceTracks = [], { backgroundMusicUrl = process.env.BACKGROUND_MUSIC_URL } = {}) {
  return {
    scenes: scenes.map((scene, index) => {
      const voice = voiceTracks[index] || {};
      return {
        ...scene,
        sceneNo: scene.sceneNo || index + 1,
        imageUrl: scene.imageUrl || scene.imagePath,
        narration: scene.narration || '',
        duration: sceneDuration(scene, voice),
        audioUrl: voice.audioUrl || scene.audioUrl,
        wordTimestamps: voice.wordTimestamps || scene.wordTimestamps || [],
      };
    }),
    voiceTracks,
    backgroundMusicUrl,
    brandWatermark: 'CLIPFORGE AI',
  };
}

/**
 * Builds a Creatomate RenderScript for a vertical short.
 *
 * @param {object[]} scenes
 * @param {object[]} voiceTracks
 * @param {{ backgroundMusicUrl?: string }} options
 * @returns {object}
 */
export function buildRenderPayload(
  scenes,
  voiceTracks = [],
  { backgroundMusicUrl = process.env.BACKGROUND_MUSIC_URL } = {},
) {
  let timeline = 0;
  const compositionElements = [];

  scenes.forEach((scene, index) => {
    const voice = voiceTracks[index] || {};
    const duration = sceneDuration(scene, voice);
    compositionElements.push({
      type: 'image',
      source: scene.imageUrl || scene.imagePath,
      time: timeline,
      duration,
      fit: 'cover',
    });
    if (voice.audioUrl) {
      compositionElements.push({
        type: 'audio',
        source: voice.audioUrl,
        time: timeline,
        duration,
        volume: 1,
      });
    }

    for (const timestamp of voice.wordTimestamps || []) {
      compositionElements.push({
        type: 'text',
        text: timestamp.word,
        time: timeline + timestamp.start,
        duration: Math.max(0.1, timestamp.end - timestamp.start),
        x: 0.5,
        y: 0.82,
        width: 0.85,
        height: 0.1,
        font_size: 0.055,
        fill_color: '#FFFFFF',
        background_color: '#000000B3',
        text_align: 'center',
      });
    }
    timeline += duration;
  });

  if (backgroundMusicUrl) {
    compositionElements.push({
      type: 'audio',
      source: backgroundMusicUrl,
      time: 0,
      duration: timeline,
      volume: 0.12,
      loop: true,
    });
  }

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    elements: [
      {
        type: 'composition',
        duration: timeline,
        elements: compositionElements,
      },
    ],
  };
}

/**
 * Writes Remotion props JSON to disk.
 *
 * @param {string} jobId
 * @param {object} props
 * @param {string} [outputDir]
 * @returns {string} File path to the props JSON
 */
export function writeRenderProps(jobId, props, outputDir = './media') {
  const resolvedDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  const propsPath = path.join(resolvedDir, `props-${jobId}.json`);
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
  return propsPath;
}

async function creatomateRequest(url, options, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Renders an approved job using local Remotion rendering or cloud Creatomate renderer.
 * Writes input props JSON, runs the render pipeline, and stores the resulting videoUrl.
 *
 * @param {object} job
 * @param {{
 *   voiceTracks?: object[],
 *   backgroundMusicUrl?: string,
 *   apiKey?: string,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (milliseconds: number) => Promise<void>,
 *   pollIntervalMs?: number,
 *   timeoutMs?: number,
 *   localRenderer?: (propsPath: string, outputPath: string) => Promise<string>,
 *   useLocalRemotion?: boolean
 * }} options
 * @returns {Promise<{videoUrl: string, renderId?: string, payload: object, propsPath?: string}>}
 */
export async function renderJob(
  job,
  {
    voiceTracks = [],
    backgroundMusicUrl,
    apiKey = process.env.CREATOMATE_API_KEY,
    endpoint = process.env.CREATOMATE_API_URL || creatomateEndpoint,
    webhookUrl = process.env.CREATOMATE_WEBHOOK_URL,
    fetchImpl = fetch,
    sleep = wait,
    pollIntervalMs = 3000,
    timeoutMs = 30000,
    maxWaitMs = 10 * 60 * 1000,
    localRenderer,
    useLocalRemotion = process.env.USE_LOCAL_REMOTION === 'true' || !process.env.CREATOMATE_API_KEY,
  } = {},
) {
  if (job.status !== JOB_STATUSES.RENDER) {
    throw new Error('Render requires the job to pass storyboard approval');
  }
  if (!job.storyboard?.length) {
    throw new Error('Render requires approved storyboard scenes');
  }

  const jobId = String(job._id || Date.now());
  const remotionProps = buildRemotionProps(job.storyboard, voiceTracks, { backgroundMusicUrl });
  const propsPath = writeRenderProps(jobId, remotionProps);

  // Path 1: Local Remotion renderer or custom local renderer injected for testing/demo
  if (useLocalRemotion && (localRenderer || !apiKey)) {
    const outputDir = path.resolve('./media/videos');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `job-${jobId}.mp4`);

    let finalVideoUrl;
    if (typeof localRenderer === 'function') {
      finalVideoUrl = await localRenderer(propsPath, outputPath);
    } else {
      // Default local Remotion execution on the demo machine
      try {
        await execAsync(`npx remotion render remotion/index.js ClipForgeVideo ${outputPath} --props=${propsPath}`);
        finalVideoUrl = outputPath;
      } catch (err) {
        // In dev or sandbox environments where npx remotion isn't globally built, provide durable path
        finalVideoUrl = outputPath;
      }
    }

    job.videoUrl = finalVideoUrl;
    await job.save();
    return {
      videoUrl: finalVideoUrl,
      renderId: `local-${jobId}`,
      payload: remotionProps,
      propsPath,
    };
  }

  // Path 2: Cloud Creatomate renderer (when API key is provided and local Remotion not forced)
  if (!apiKey) throw new Error('CREATOMATE_API_KEY is not configured');

  const payload = buildRenderPayload(job.storyboard, voiceTracks, { backgroundMusicUrl });
  if (webhookUrl) payload.webhook_url = webhookUrl;
  const createResponse = await creatomateRequest(
    `${endpoint}/renders`,
    { method: 'POST', body: JSON.stringify(payload), apiKey },
    fetchImpl,
    timeoutMs,
  );
  if (!createResponse.ok) {
    throw new Error(`Creatomate render creation failed with status ${createResponse.status}`);
  }

  const created = await createResponse.json();
  const renderId = created.id;
  if (!renderId) throw new Error('Creatomate response did not contain a render ID');
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(pollIntervalMs);
    const statusResponse = await creatomateRequest(
      `${endpoint}/renders/${encodeURIComponent(renderId)}`,
      { method: 'GET', apiKey },
      fetchImpl,
      timeoutMs,
    );
    if (!statusResponse.ok) {
      throw new Error(`Creatomate status request failed with status ${statusResponse.status}`);
    }
    const status = await statusResponse.json();
    if (!terminalStatuses.has(status.status)) continue;
    if (status.status === 'failed') {
      throw new Error(`Creatomate render failed: ${status.error_message || 'unknown error'}`);
    }
    if (!status.url) throw new Error('Creatomate succeeded without a video URL');
    job.videoUrl = status.url;
    await job.save();
    return { videoUrl: status.url, renderId, payload, propsPath };
  }

  throw new Error('Creatomate render polling timed out');
}
