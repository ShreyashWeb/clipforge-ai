import { describe, expect, it, vi } from 'vitest';
import {
  buildRemotionProps,
  buildRenderPayload,
  renderJob,
  writeRenderProps,
} from '../src/services/render.js';

const job = () => ({
  _id: 'job-123',
  status: 'RENDER',
  storyboard: [
    { sceneNo: 1, imageUrl: 'https://cdn.example.com/one.jpg', duration: 4, narration: 'First scene' },
    { sceneNo: 2, imageUrl: 'https://cdn.example.com/two.jpg', duration: 5, narration: 'Second scene' },
  ],
  videoUrl: null,
  save: vi.fn(async function save() {
    return this;
  }),
});

describe('render service (Remotion local & Cloud)', () => {
  it('builds a vertical Remotion props payload with narration, captions, and ducked music', () => {
    const props = buildRemotionProps(
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

    expect(props.scenes).toHaveLength(2);
    expect(props.backgroundMusicUrl).toBe('https://cdn.example.com/music.mp3');
    expect(props.scenes[0].wordTimestamps[0].word).toBe('Hello');
  });

  it('writes render props JSON to disk', () => {
    const props = buildRemotionProps(job().storyboard, []);
    const propsPath = writeRenderProps('job-test-write', props);
    expect(propsPath).toContain('props-job-test-write.json');
  });

  it('renders locally via localRenderer and saves completed videoUrl to job', async () => {
    const currentJob = job();
    const localRenderer = vi.fn(async () => 'https://cdn.example.com/local-rendered-video.mp4');

    const result = await renderJob(currentJob, {
      useLocalRemotion: true,
      localRenderer,
      voiceTracks: [{ audioUrl: 'https://cdn.example.com/v1.mp3', durationSeconds: 4 }],
    });

    expect(result.videoUrl).toBe('https://cdn.example.com/local-rendered-video.mp4');
    expect(currentJob.videoUrl).toBe('https://cdn.example.com/local-rendered-video.mp4');
    expect(currentJob.save).toHaveBeenCalledOnce();
    expect(localRenderer).toHaveBeenCalledOnce();
  });

  it('creates, polls, and stores the completed video URL via Creatomate fallback', async () => {
    const responses = [
      { ok: true, json: async () => ({ id: 'render-1' }) },
      { ok: true, json: async () => ({ status: 'rendering' }) },
      { ok: true, json: async () => ({ status: 'succeeded', url: 'https://cdn.example.com/video.mp4' }) },
    ];
    const fetchImpl = vi.fn(async () => responses.shift());
    const currentJob = job();
    const result = await renderJob(currentJob, {
      useLocalRemotion: false,
      apiKey: 'creatomate-test',
      fetchImpl,
      sleep: vi.fn(),
    });
    expect(result.videoUrl).toBe('https://cdn.example.com/video.mp4');
    expect(currentJob.videoUrl).toBe(result.videoUrl);
    expect(currentJob.save).toHaveBeenCalledOnce();
  });

  it('does not call render before storyboard approval', async () => {
    const fetchImpl = vi.fn();
    await expect(
      renderJob({ ...job(), status: 'STORYBOARD_APPROVAL' }, { apiKey: 'test', fetchImpl }),
    ).rejects.toThrow('pass storyboard approval');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
