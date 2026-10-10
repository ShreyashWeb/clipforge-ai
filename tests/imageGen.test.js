import { describe, expect, it, vi } from 'vitest';
import {
  generateSceneImage,
  generateStoryboardImages,
  sendStoryboardAlbum,
} from '../src/services/imageGen.js';

describe('image generation service (Cloudflare Workers AI Flux / REST)', () => {
  it('generates a Flux image via REST and reports its estimated cost', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ result: { sample: 'https://cdn.example.com/scene.png' } }),
    }));

    const result = await generateSceneImage(
      { visualPrompt: 'A cinematic battery facility at dusk' },
      { apiKey: 'flux-test', fetchImpl, costPerImage: 0.07 },
    );

    expect(result).toEqual({ url: 'https://cdn.example.com/scene.png', cost: 0.07 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('supports Cloudflare Workers AI Flux binary buffer responses and saves locally', async () => {
    const dummyImageBytes = Buffer.from('FAKE_PNG_BYTES');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => dummyImageBytes.buffer,
    }));

    const result = await generateSceneImage(
      { sceneNo: 1, visualPrompt: 'A futuristic quantum computer lab' },
      {
        accountId: 'test-cf-account',
        apiToken: 'test-cf-token',
        fetchImpl,
        storageDir: './media/images',
      },
    );

    expect(result.cost).toBeGreaterThan(0);
    expect(result.url).toContain('.png');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('api.cloudflare.com/client/v4/accounts/test-cf-account/ai/run'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('retries rate limits and generates a complete storyboard', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ url: 'https://cdn.example.com/one.png' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ url: 'https://cdn.example.com/two.png' }),
      });

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

  it('sends storyboard scenes as Telegram photo album with review buttons', async () => {
    const ctx = {
      chat: { id: 12345 },
      api: {
        sendMediaGroup: vi.fn(async () => {}),
      },
      reply: vi.fn(async () => {}),
    };
    const job = {
      _id: 'job-123',
      costEstimate: 0.06,
      storyboard: [
        { sceneNo: 1, imageUrl: 'https://cdn.example.com/1.png', narration: 'Scene one narration' },
        { sceneNo: 2, imageUrl: 'https://cdn.example.com/2.png', narration: 'Scene two narration' },
      ],
    };

    await sendStoryboardAlbum(ctx, job);

    expect(ctx.api.sendMediaGroup).toHaveBeenCalledWith(12345, expect.arrayContaining([
      expect.objectContaining({ type: 'photo', media: 'https://cdn.example.com/1.png' }),
      expect.objectContaining({ type: 'photo', media: 'https://cdn.example.com/2.png' }),
    ]));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Storyboard visual draft generated'),
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });

  it('fails before making a paid call when credentials are missing', async () => {
    const fetchImpl = vi.fn();
    await expect(
      generateSceneImage({ visualPrompt: 'A scene' }, { apiKey: '', apiToken: '', fetchImpl }),
    ).rejects.toThrow('FLUX_API_KEY is not configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
