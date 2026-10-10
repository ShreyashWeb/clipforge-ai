import { describe, expect, it, vi } from 'vitest';
import {
  buildDeliveryCaption,
  deliverJob,
  formatSourceLinks,
} from '../src/pipeline/deliver.js';

const job = () => ({
  _id: 'job-del-1',
  userId: 'user-123',
  topic: 'Nuclear Fusion Breakthrough in Magnetic Confinement',
  status: 'FINAL_APPROVAL',
  videoUrl: 'https://cdn.example.com/fusion-short.mp4',
  sources: [
    { title: 'Nature Physics: High-beta Tokamak plasma', url: 'https://nature.com/articles/fusion' },
    { title: 'MIT News: Superconducting magnets', url: 'https://news.mit.edu/magnet' },
  ],
  trace: [],
  save: vi.fn(async function save() {
    return this;
  }),
});

describe('deliver pipeline', () => {
  it('formats verified source links with clickable markdown', () => {
    const formatted = formatSourceLinks([
      { title: 'Nature', url: 'https://nature.com' },
      { url: 'https://arxiv.org/abs/1234' },
    ]);
    expect(formatted).toContain('1. [Nature](https://nature.com)');
    expect(formatted).toContain('2. [https://arxiv.org/abs/1234](https://arxiv.org/abs/1234)');
  });

  it('builds delivery caption with download link and source citations', () => {
    const caption = buildDeliveryCaption(job());
    expect(caption).toContain('Nuclear Fusion Breakthrough');
    expect(caption).toContain('https://cdn.example.com/fusion-short.mp4');
    expect(caption).toContain('https://nature.com/articles/fusion');
  });

  it('sends video file to Telegram and advances job to DELIVERED', async () => {
    const currentJob = job();
    const sendVideo = vi.fn(async () => {});

    const result = await deliverJob(currentJob, {
      chatId: 98765,
      sendVideo,
      enableYouTube: false,
    });

    expect(result.delivered).toBe(true);
    expect(result.videoUrl).toBe('https://cdn.example.com/fusion-short.mp4');
    expect(sendVideo).toHaveBeenCalledWith(
      98765,
      'https://cdn.example.com/fusion-short.mp4',
      expect.stringContaining('Nuclear Fusion Breakthrough'),
    );
    expect(currentJob.status).toBe('DELIVERED');
    expect(currentJob.trace.some((t) => t.step === 'deliver')).toBe(true);
    expect(currentJob.save).toHaveBeenCalledOnce();
  });

  it('uploads to YouTube when enabled, and falls back to download link on YouTube failure', async () => {
    const currentJob = job();
    const youtubePublisher = vi.fn(async () => {
      throw new Error('YouTube Quota Exceeded');
    });
    const ctx = {
      chat: { id: 123 },
      replyWithVideo: vi.fn(async () => {}),
      reply: vi.fn(async () => {}),
    };

    const result = await deliverJob(currentJob, {
      ctx,
      enableYouTube: true,
      youtubePublisher,
    });

    expect(result.delivered).toBe(true);
    expect(result.youtubeUrl).toBeNull();
    expect(ctx.replyWithVideo).toHaveBeenCalledOnce();
    expect(currentJob.status).toBe('DELIVERED');
  });
});
