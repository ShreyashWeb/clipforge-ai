import { JOB_STATUSES } from '../pipeline/stateMachine.js';

const creatomateEndpoint = 'https://api.creatomate.com/v2';
const terminalStatuses = new Set(['succeeded', 'failed']);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sceneDuration(scene, voice) {
  return Number(voice?.durationSeconds || scene.duration || 4);
}

/**
 * Builds a Creatomate RenderScript for a vertical short.
 *
 * Assumptions based on Creatomate's REST API documentation:
 * - RenderScript is supplied directly as `elements` instead of using `template_id`.
 * - `composition`, `image`, `audio`, and `text` elements accept the documented
 *   `time`/`duration` fields. Caption text is represented as timed text elements
 *   because this service receives word timestamps from ElevenLabs, not an SRT URL.
 * - Creatomate's `audio` volume is a normalized 0-1 value, so background music is
 *   ducked to 0.12 while narration remains at full volume.
 *
 * @param {object[]} scenes
 * @param {object[]} voiceTracks
 * @param {{ backgroundMusicUrl?: string }} options
 * @returns {object}
 */
export function buildRenderPayload(
  scenes,
  voiceTracks,
  { backgroundMusicUrl = process.env.BACKGROUND_MUSIC_URL } = {},
) {
  let timeline = 0;
  const compositionElements = [];

  scenes.forEach((scene, index) => {
    const voice = voiceTracks[index] || {};
    const duration = sceneDuration(scene, voice);
    compositionElements.push({
      type: 'image',
      source: scene.imageUrl,
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
 * Renders an approved job and stores the completed video URL.
 *
 * @param {object} job
 * @param {{ voiceTracks?: object[], backgroundMusicUrl?: string, apiKey?: string, fetchImpl?: typeof fetch, sleep?: (milliseconds: number) => Promise<void>, pollIntervalMs?: number, timeoutMs?: number }} options
 * @returns {Promise<{videoUrl: string, renderId: string, payload: object}>}
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
  } = {},
) {
  if (job.status !== JOB_STATUSES.RENDER) {
    throw new Error('Render requires the job to pass storyboard approval');
  }
  if (!apiKey) throw new Error('CREATOMATE_API_KEY is not configured');
  if (!job.storyboard?.length) throw new Error('Render requires approved storyboard scenes');

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
    return { videoUrl: status.url, renderId, payload };
  }

  throw new Error('Creatomate render polling timed out');
}
