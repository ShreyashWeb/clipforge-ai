import fs from 'fs';
import path from 'path';

const elevenLabsEndpoint = 'https://api.elevenlabs.io/v1/text-to-speech';
const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';
const maxCharactersPerRequest = 4500;
const maxAttempts = 3;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Splits text into chunks by word boundaries to obey character limits.
 *
 * @param {string} text
 * @param {number} maxCharacters
 * @returns {string[]}
 */
export function splitText(text, maxCharacters) {
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Extracts word-level timestamps from ElevenLabs character-level alignment payload.
 *
 * @param {object} payload
 * @returns {Array<{word: string, start: number, end: number}>}
 */
export function timestampsFromPayload(payload) {
  const characters = payload.alignment?.characters || [];
  const starts = payload.alignment?.character_start_times_seconds || [];
  const ends = payload.alignment?.character_end_times_seconds || [];
  const words = [];
  let word = '';

  characters.forEach((character, index) => {
    if (/\s/.test(character)) {
      if (word) {
        words.push({
          word,
          start: starts[index - word.length] ?? 0,
          end: ends[index - 1] ?? starts[index - 1] ?? 0,
        });
        word = '';
      }
      return;
    }
    word += character;
  });

  if (word) {
    words.push({
      word,
      start: starts[characters.length - word.length] ?? 0,
      end: ends[characters.length - 1] ?? starts[characters.length - 1] ?? 0,
    });
  }
  return words;
}

/**
 * Generates synthetic word timestamps for fallback audio.
 * Computes natural ~0.3s timing per word based on length.
 *
 * @param {string} text
 * @param {number} [startOffset]
 * @returns {{wordTimestamps: Array<{word: string, start: number, end: number}>, durationSeconds: number}}
 */
export function generateSyntheticTimestamps(text, startOffset = 0) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let currentTime = startOffset;
  const wordTimestamps = [];

  for (const word of words) {
    const wordDuration = Math.max(0.2, Math.min(0.6, word.length * 0.055 + 0.15));
    wordTimestamps.push({
      word,
      start: Number(currentTime.toFixed(3)),
      end: Number((currentTime + wordDuration).toFixed(3)),
    });
    currentTime += wordDuration;
  }

  const durationSeconds = Number((currentTime - startOffset).toFixed(3));
  return { wordTimestamps, durationSeconds };
}

/**
 * Fallback voice provider interface to ensure free-tier limits or quota exhaustion
 * never block the interactive demo or pipeline execution.
 */
export class FallbackVoiceProvider {
  /**
   * @param {{
   *   storageDir?: string,
   *   uploadAudio?: (base64: string, metadata: object) => Promise<string>
   * }} [options]
   */
  constructor({ storageDir = './media/audio', uploadAudio } = {}) {
    this.storageDir = storageDir;
    this.uploadAudio = uploadAudio;
  }

  /**
   * Generates a fallback audio track with synthetic word timestamps.
   *
   * @param {{ narration: string, sceneNo?: number }} scene
   * @param {object} [options]
   * @returns {Promise<{sceneNo?: number, audioUrl: string, audioUrls: string[], durationSeconds: number, wordTimestamps: object[], isFallback: boolean}>}
   */
  async generate(scene, options = {}) {
    const { wordTimestamps, durationSeconds } = generateSyntheticTimestamps(scene.narration);
    const sceneNum = scene.sceneNo || 1;
    const fallbackBase64 = 'UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='; // Valid tiny WAV header

    let audioUrl;
    if (typeof options.uploadAudio === 'function') {
      audioUrl = await options.uploadAudio(fallbackBase64, { sceneNo: sceneNum, isFallback: true });
    } else if (typeof this.uploadAudio === 'function') {
      audioUrl = await this.uploadAudio(fallbackBase64, { sceneNo: sceneNum, isFallback: true });
    } else {
      const resolvedDir = path.resolve(this.storageDir);
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }
      const filename = `fallback-voice-scene-${sceneNum}-${Date.now()}.wav`;
      const filePath = path.join(resolvedDir, filename);
      fs.writeFileSync(filePath, Buffer.from(fallbackBase64, 'base64'));
      audioUrl = filePath;
    }

    return {
      sceneNo: scene.sceneNo,
      audioUrl,
      audioUrls: [audioUrl],
      durationSeconds: Math.max(2, durationSeconds),
      wordTimestamps,
      isFallback: true,
    };
  }
}

export const defaultFallbackProvider = new FallbackVoiceProvider();

async function generateChunk(text, voiceId, options) {
  const {
    apiKey = process.env.ELEVENLABS_API_KEY,
    endpoint = process.env.ELEVENLABS_API_URL || elevenLabsEndpoint,
    modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    fetchImpl = fetch,
    timeoutMs = 30000,
    sleep = wait,
  } = options;

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${endpoint}/${encodeURIComponent(voiceId)}/with-timestamps`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          output_format: 'mp3_44100_128',
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`ElevenLabs request failed with status ${response.status}`);
        if (response.status !== 429 && response.status < 500) throw error;
        lastError = error;
      } else {
        const payload = await response.json();
        if (!payload.audio_base64) throw new Error('ElevenLabs response did not contain audio');
        return { audioBase64: payload.audio_base64, timestamps: timestampsFromPayload(payload) };
      }
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('ElevenLabs request timed out') : error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < maxAttempts - 1) await sleep(250 * 2 ** attempt);
  }

  throw new Error(`ElevenLabs narration failed after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Generates narration for one storyboard scene.
 * If ElevenLabs is unavailable or fails due to free-tier quota limits, seamlessly
 * falls back to the fallback voice provider.
 *
 * @param {{ narration: string, sceneNo?: number }} scene
 * @param {{
 *   voiceId?: string,
 *   user?: { voiceId?: string },
 *   defaultVoiceId?: string,
 *   uploadAudio?: (audioBase64: string, metadata: object) => Promise<string>,
 *   maxCharactersPerRequest?: number,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (milliseconds: number) => Promise<void>,
 *   fallbackProvider?: FallbackVoiceProvider,
 *   enableFallback?: boolean
 * }} options
 * @returns {Promise<{sceneNo?: number, audioUrl: string, audioUrls: string[], durationSeconds: number, wordTimestamps: object[]}>}
 */
export async function generateSceneVoice(
  scene,
  {
    voiceId,
    user,
    defaultVoiceId: fallbackVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID || defaultVoiceId,
    uploadAudio,
    maxCharactersPerRequest: chunkSize = maxCharactersPerRequest,
    fallbackProvider = defaultFallbackProvider,
    enableFallback = false,
    ...options
  } = {},
) {
  if (!scene?.narration?.trim()) throw new Error('Scene narration is required');
  const selectedVoiceId = voiceId || user?.voiceId || fallbackVoiceId;

  try {
    const chunks = splitText(scene.narration, chunkSize);
    const audioUrls = [];
    const wordTimestamps = [];
    let durationSeconds = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const generated = await generateChunk(chunks[index], selectedVoiceId, { ...options, uploadAudio });
      const offsetTimestamps = generated.timestamps.map((timestamp) => ({
        ...timestamp,
        start: timestamp.start + durationSeconds,
        end: timestamp.end + durationSeconds,
      }));
      const chunkDuration =
        offsetTimestamps.length > 0
          ? offsetTimestamps[offsetTimestamps.length - 1].end - durationSeconds
          : 0;

      let audioUrl;
      if (typeof uploadAudio === 'function') {
        audioUrl = await uploadAudio(generated.audioBase64, {
          sceneNo: scene.sceneNo,
          chunkNo: index + 1,
          voiceId: selectedVoiceId,
          contentType: 'audio/mpeg',
        });
      } else {
        const audioDir = path.resolve('./media/audio');
        if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
        const filePath = path.join(audioDir, `scene-${scene.sceneNo || 1}-chunk-${index + 1}.mp3`);
        fs.writeFileSync(filePath, Buffer.from(generated.audioBase64, 'base64'));
        audioUrl = filePath;
      }

      audioUrls.push(audioUrl);
      wordTimestamps.push(...offsetTimestamps);
      durationSeconds += Math.max(0, chunkDuration);
    }

    return {
      sceneNo: scene.sceneNo,
      audioUrl: audioUrls[0],
      audioUrls,
      durationSeconds,
      wordTimestamps,
    };
  } catch (error) {
    if (enableFallback) {
      console.warn(`ElevenLabs voice synthesis failed (${error.message}); falling back to fallback voice provider.`);
      return fallbackProvider.generate(scene, { uploadAudio, ...options });
    }
    throw error;
  }
}

/**
 * Generates narration for every storyboard scene.
 *
 * @param {object[]} scenes
 * @param {Parameters<typeof generateSceneVoice>[1]} options
 * @returns {Promise<object[]>}
 */
export async function generateStoryboardVoice(scenes, options = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('At least one storyboard scene is required');
  }
  const results = [];
  for (const scene of scenes) {
    results.push(await generateSceneVoice(scene, options));
  }
  return results;
}
