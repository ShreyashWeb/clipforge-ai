import { describe, expect, it, vi } from 'vitest';
import { generateSceneImage, generateStoryboardImages } from '../src/services/imageGen.js';

describe('image generation service', () => {
  it('generates a Flux image and reports its estimated cost', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: { sample: 'https://cdn.example.com/scene.png' } }),
    }));

    const result = await generateSceneImage(
      { visualPrompt: 'A cinematic battery facility at dusk' },
      { apiKey: 'flux-test', fetchImpl, costPerImage: 0.07 },
    );

    expect(result).toEqual({ url: 'https://cdn.example.com/scene.png', cost: 0.07 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries rate limits and generates a complete storyboard', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn.example.com/one.png' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn.example.com/two.png' }) });

    const result = await generateStoryboardImages(
      [
        { sceneNo: 1, visualPrompt: 'First scene' },
        { sceneNo: 2, visualPrompt: 'Second scene' },
      ],
      { apiKey: 'flux-test', fetchImpl, sleep: vi.fn(), costPerImage: 0.05 },
    );

    expect(result.storyboard.map((scene) => scene.imageUrl)).toEqual([
      'https://cdn.example.com/one.png',
      'https://cdn.example.com/two.png',
    ]);
    expect(result.cost).toBe(0.1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails before making a paid call when credentials are missing', async () => {
    const fetchImpl = vi.fn();
    await expect(
      generateSceneImage({ visualPrompt: 'A scene' }, { apiKey: '', fetchImpl }),
    ).rejects.toThrow('FLUX_API_KEY is not configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
