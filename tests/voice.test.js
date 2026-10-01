import { describe, expect, it, vi } from 'vitest';
import { generateSceneVoice, generateStoryboardVoice, splitText } from '../src/services/voice.js';

function response(audioBase64 = 'YXVkaW8=') {
  return {
    ok: true,
    json: async () => ({
      audio_base64: audioBase64,
      alignment: {
        characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e'],
        character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
        character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      },
    }),
  };
}

describe('voice service', () => {
  it('uses the saved voice ID and returns an uploaded URL with timestamps', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.headers['xi-api-key']).toBe('test-key');
      expect(url).toContain('saved-voice');
      return response();
    });
    const uploadAudio = vi.fn(async () => 'https://cdn.example.com/scene.mp3');

    const result = await generateSceneVoice(
      { sceneNo: 1, narration: 'Hi there' },
      { user: { voiceId: 'saved-voice' }, apiKey: 'test-key', fetchImpl, uploadAudio },
    );

    expect(result.audioUrl).toBe('https://cdn.example.com/scene.mp3');
    expect(result.audioUrls).toHaveLength(1);
    expect(result.wordTimestamps.map((item) => item.word)).toEqual(['Hi', 'there']);
  });

  it('splits long narration and returns one URL per chunk', async () => {
    const text = 'word '.repeat(20);
    const fetchImpl = vi.fn(async () => response());
    const uploadAudio = vi
      .fn()
      .mockResolvedValueOnce('https://cdn.example.com/one.mp3')
      .mockResolvedValueOnce('https://cdn.example.com/two.mp3');

    const result = await generateSceneVoice(
      { narration: text },
      { apiKey: 'test-key', fetchImpl, uploadAudio, maxCharactersPerRequest: 20 },
    );

    expect(splitText(text, 20).length).toBeGreaterThan(1);
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
    expect(result.audioUrls).toHaveLength(splitText(text, 20).length);
  });

  it('generates narration for each scene', async () => {
    const result = await generateStoryboardVoice(
      [{ sceneNo: 1, narration: 'First' }, { sceneNo: 2, narration: 'Second' }],
      {
        apiKey: 'test-key',
        fetchImpl: vi.fn(async () => response()),
        uploadAudio: vi.fn(async (_audio, metadata) => `https://cdn.example.com/${metadata.sceneNo}.mp3`),
      },
    );
    expect(result.map((item) => item.sceneNo)).toEqual([1, 2]);
  });

  it('fails before a paid call when credentials are missing', async () => {
    const fetchImpl = vi.fn();
    await expect(
      generateSceneVoice({ narration: 'Hello' }, { apiKey: '', fetchImpl }),
    ).rejects.toThrow('ELEVENLABS_API_KEY is not configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
