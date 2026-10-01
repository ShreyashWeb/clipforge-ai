import { describe, expect, it, vi } from 'vitest';
import { buildRenderPayload, renderJob } from '../src/services/render.js';

const job = () => ({
  status: 'RENDER',
  storyboard: [
    { sceneNo: 1, imageUrl: 'https://cdn.example.com/one.jpg', duration: 4 },
    { sceneNo: 2, imageUrl: 'https://cdn.example.com/two.jpg', duration: 5 },
  ],
  videoUrl: null,
  save: vi.fn(async function save() {
    return this;
  }),
});

describe('render service', () => {
  it('builds a vertical payload with narration, captions, and ducked music', () => {
    const payload = buildRenderPayload(
      job().storyboard,
      [
        {
          audioUrl: 'https://cdn.example.com/one.mp3',
          durationSeconds: 4,
          wordTimestamps: [{ word: 'Hello', start: 0, end: 0.5 }],
        },
        { audioUrl: 'https://cdn.example.com/two.mp3', durationSeconds: 5 },
      ],
      { backgroundMusicUrl: 'https://cdn.example.com/music.mp3' },
    );
    const elements = payload.elements[0].elements;
    expect(payload.width).toBe(1080);
    expect(payload.height).toBe(1920);
    expect(elements.find((element) => element.type === 'text').text).toBe('Hello');
    expect(elements.find((element) => element.source?.endsWith('music.mp3')).volume).toBe(0.12);
  });

  it('creates, polls, and stores the completed video URL', async () => {
    const responses = [
      { ok: true, json: async () => ({ id: 'render-1' }) },
      { ok: true, json: async () => ({ status: 'rendering' }) },
      { ok: true, json: async () => ({ status: 'succeeded', url: 'https://cdn.example.com/video.mp4' }) },
    ];
    const fetchImpl = vi.fn(async () => responses.shift());
    const currentJob = job();
    const result = await renderJob(currentJob, {
      apiKey: 'creatomate-test',
      fetchImpl,
      sleep: vi.fn(),
    });
    expect(result.videoUrl).toBe('https://cdn.example.com/video.mp4');
    expect(currentJob.videoUrl).toBe(result.videoUrl);
    expect(currentJob.save).toHaveBeenCalledOnce();
  });

  it('does not call Creatomate before storyboard approval', async () => {
    const fetchImpl = vi.fn();
    await expect(renderJob({ ...job(), status: 'STORYBOARD_APPROVAL' }, { apiKey: 'test', fetchImpl }))
      .rejects.toThrow('pass storyboard approval');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
