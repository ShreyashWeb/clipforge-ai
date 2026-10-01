import { JOB_STATUSES } from '../pipeline/stateMachine.js';

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const uploadEndpoint = 'https://www.googleapis.com/upload/youtube/v3/videos';
const maxAttempts = 3;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sourceLinks(sources = []) {
  return sources
    .filter((source) => source?.url)
    .map((source) => `- ${source.title || source.url}: ${source.url}`)
    .join('\n');
}

function shortTitle(topic) {
  const title = `${topic} #Shorts`;
  return title.length <= 100 ? title : `${topic.slice(0, 92).trim()} #Shorts`;
}

/**
 * Builds YouTube metadata for a source-grounded Short.
 *
 * @param {object} job
 * @returns {{snippet: object, status: object}}
 */
export function buildYouTubeMetadata(job) {
  const links = sourceLinks(job.sources);
  return {
    snippet: {
      title: shortTitle(job.topic),
      description: `A source-grounded ClipForge AI short about ${job.topic}.\n\nSources:\n${links || 'No source links available.'}`,
      categoryId: '22',
      tags: ['Shorts', 'ClipForge AI'],
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'private',
      selfDeclaredMadeForKids: false,
    },
  };
}

async function requestToken(refreshToken, options) {
  const {
    clientId = process.env.YOUTUBE_CLIENT_ID,
    clientSecret = process.env.YOUTUBE_CLIENT_SECRET,
    fetchImpl = fetch,
    endpoint = tokenEndpoint,
    timeoutMs = 15000,
  } = options;
  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are required');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`YouTube OAuth refresh failed with status ${response.status}`);
    const payload = await response.json();
    if (!payload.access_token) throw new Error('YouTube OAuth response did not contain an access token');
    return payload.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(options) {
  if (options.accessToken) return options.accessToken;
  const refreshToken = options.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('A YouTube access token or YOUTUBE_REFRESH_TOKEN is required');
  }
  return requestToken(refreshToken, options);
}

async function downloadVideo(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Video download failed with status ${response.status}`);
    return response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadOnce(videoBytes, metadata, accessToken, options) {
  const {
    fetchImpl = fetch,
    endpoint = uploadEndpoint,
    timeoutMs = 30000,
  } = options;
  const initController = new AbortController();
  const initTimeout = setTimeout(() => initController.abort(), timeoutMs);
  let uploadUrl;
  try {
    const initializeResponse = await fetchImpl(
      `${endpoint}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata),
        signal: initController.signal,
      },
    );
    if (!initializeResponse.ok) {
      throw new Error(`YouTube upload initialization failed with status ${initializeResponse.status}`);
    }
    uploadUrl = initializeResponse.headers.get('location');
  } finally {
    clearTimeout(initTimeout);
  }
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL');

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), timeoutMs);
  try {
    const uploadResponse = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'video/mp4',
      },
      body: videoBytes,
      signal: uploadController.signal,
    });
    if (!uploadResponse.ok) {
      throw new Error(`YouTube video upload failed with status ${uploadResponse.status}`);
    }
    return uploadResponse.json();
  } finally {
    clearTimeout(uploadTimeout);
  }
}

/**
 * Uploads an approved job video to YouTube as a Short.
 *
 * If YouTube rejects the upload (including unverified-app restrictions), the
 * fallback notifier receives the download URL. The reason is logged for
 * operator diagnosis; no failure is hidden from the caller's fallback path.
 *
 * @param {object} job
 * @param {{accessToken?: string, refreshToken?: string, fetchImpl?: typeof fetch, notifyFallback?: (message: string, details: object) => Promise<void>, sleep?: (milliseconds: number) => Promise<void>}} options
 * @returns {Promise<{published: boolean, videoId?: string, videoUrl?: string, fallback: boolean, reason?: string}>}
 */
export async function uploadApprovedVideo(
  job,
  {
    accessToken,
    refreshToken,
    fetchImpl = fetch,
    notifyFallback = async () => {},
    sleep = wait,
    ...options
  } = {},
) {
  if (job.status !== JOB_STATUSES.PUBLISHED) {
    throw new Error('YouTube upload requires final approval');
  }
  if (!job.videoUrl) throw new Error('YouTube upload requires a rendered video URL');

  try {
    const token = await getAccessToken({ ...options, accessToken, refreshToken, fetchImpl });
    const videoBytes = await downloadVideo(job.videoUrl, fetchImpl, options.timeoutMs || 30000);
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const uploaded = await uploadOnce(
          videoBytes,
          buildYouTubeMetadata(job),
          token,
          { ...options, fetchImpl },
        );
        const videoId = uploaded.id;
        if (!videoId) throw new Error('YouTube upload response did not contain a video ID');
        return {
          published: true,
          videoId,
          videoUrl: `https://youtu.be/${videoId}`,
          fallback: false,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) await sleep(250 * 2 ** attempt);
      }
    }
    throw lastError;
  } catch (error) {
    const reason = error.message;
    console.error(`YouTube upload unavailable for job ${job._id || job.topic}: ${reason}`);
    const message = `YouTube publishing was unavailable (${reason}). Download your video here: ${job.videoUrl}`;
    await notifyFallback(message, { job, reason, videoUrl: job.videoUrl });
    return { published: false, fallback: true, videoUrl: job.videoUrl, reason };
  }
}
