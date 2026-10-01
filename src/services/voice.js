const elevenLabsEndpoint = 'https://api.elevenlabs.io/v1/text-to-speech';
const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';
const maxCharactersPerRequest = 4500;
const maxAttempts = 3;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function splitText(text, maxCharacters) {
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

function timestampsFromPayload(payload) {
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
 *
 * The uploader is intentionally injectable because ElevenLabs returns audio bytes,
 * while the application needs a durable URL for later rendering.
 *
 * @param {{ narration: string, sceneNo?: number }} scene
 * @param {{
 *   voiceId?: string,
 *   user?: { voiceId?: string },
 *   defaultVoiceId?: string,
 *   uploadAudio?: (audioBase64: string, metadata: object) => Promise<string>,
 *   maxCharactersPerRequest?: number,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (milliseconds: number) => Promise<void>
 * }} options
 * @returns {Promise<{sceneNo?: number, audioUrl: string, audioUrls: string[], durationSeconds: number, wordTimestamps: object[]}>}
 */
export async function generateSceneVoice(
  scene,
  {
    voiceId,
    user,
    defaultVoiceId: fallbackVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID || defaultVoiceId,
    uploadAudio = async () => {
      throw new Error('An audio upload service is required');
    },
    maxCharactersPerRequest: chunkSize = maxCharactersPerRequest,
    ...options
  } = {},
) {
  if (!scene?.narration?.trim()) throw new Error('Scene narration is required');
  const selectedVoiceId = voiceId || user?.voiceId || fallbackVoiceId;
  const chunks = splitText(scene.narration, chunkSize);
  const audioUrls = [];
  const wordTimestamps = [];
  let durationSeconds = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const generated = await generateChunk(chunks[index], selectedVoiceId, options);
    const offsetTimestamps = generated.timestamps.map((timestamp) => ({
      ...timestamp,
      start: timestamp.start + durationSeconds,
      end: timestamp.end + durationSeconds,
    }));
    const chunkDuration =
      offsetTimestamps.length > 0
        ? offsetTimestamps[offsetTimestamps.length - 1].end - durationSeconds
        : 0;
    const audioUrl = await uploadAudio(generated.audioBase64, {
      sceneNo: scene.sceneNo,
      chunkNo: index + 1,
      voiceId: selectedVoiceId,
      contentType: 'audio/mpeg',
    });
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

export { splitText, timestampsFromPayload };
