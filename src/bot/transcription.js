/**
 * Transcribes an audio buffer using Gemini multimodal API or OpenAI/Groq Whisper audio transcription.
 *
 * @param {Buffer} audioBuffer
 * @param {{
 *   apiKey?: string,
 *   geminiApiKey?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number
 * }} options
 * @returns {Promise<string>}
 */
export async function transcribeAudio(
  audioBuffer,
  {
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
    geminiApiKey = process.env.GEMINI_API_KEY,
    fetchImpl = fetch,
    timeoutMs = 30000,
  } = {},
) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty');
  }

  // 1. If Gemini API key is configured, use Gemini 1.5 Flash multimodal transcription
  if (geminiApiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const base64Audio = audioBuffer.toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/ogg',
                    data: base64Audio,
                  },
                },
                {
                  text: 'Accurately transcribe the speech in this audio. Return ONLY the transcribed text without additional commentary or formatting.',
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini transcription failed with status ${response.status}`);
      }

      const payload = await response.json();
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Transcription request timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // 2. Fallback to Whisper endpoint if LLM_API_KEY / OPENAI_API_KEY is configured
  if (apiKey) {
    const whisperEndpoint = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'whisper-1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(whisperEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Whisper transcription failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (payload.text) return payload.text.trim();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Whisper transcription timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('No audio transcription API key (GEMINI_API_KEY or LLM_API_KEY) configured');
}
