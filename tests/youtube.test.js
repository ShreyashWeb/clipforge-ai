import { describe, expect, it, vi } from 'vitest';
import { buildYouTubeMetadata, uploadApprovedVideo } from '../src/services/youtube.js';

function headers(values = {}) {
  return { get: (key) => values[key.toLowerCase()] || null };
}

const approvedJob = {
  _id: 'job-1',
  status: 'PUBLISHED',
  topic: 'Battery storage',
  videoUrl: 'https://cdn.example.com/video.mp4',
  sources: [{ title: 'Energy report', url: 'https://example.com/report' }],
};

describe('YouTube service', () => {
  it('builds Short metadata with source links', () => {
    const metadata = buildYouTubeMetadata(approvedJob);
    expect(metadata.snippet.title).toContain('#Shorts');
    expect(metadata.snippet.description).toContain('https://example.com/report');
    expect(metadata.status.privacyStatus).toBe('private');
  });

  it('uploads the rendered video through the resumable API', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: headers({ location: 'https://upload.youtube.test/session' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'abc123' }),
      });

    const result = await uploadApprovedVideo(approvedJob, {
      accessToken: 'access-token',
      fetchImpl,
      sleep: vi.fn(),
    });

    expect(result).toEqual({
      published: true,
      videoId: 'abc123',
      videoUrl: 'https://youtu.be/abc123',
      fallback: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('falls back to Telegram notification when YouTube rejects the upload', async () => {
    const notifyFallback = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
      .mockResolvedValue({ ok: false, status: 403 });

    const result = await uploadApprovedVideo(approvedJob, {
      accessToken: 'access-token',
      fetchImpl,
      notifyFallback,
      sleep: vi.fn(),
    });

    expect(result.published).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.reason).toContain('403');
    expect(notifyFallback).toHaveBeenCalledWith(
      expect.stringContaining(approvedJob.videoUrl),
      expect.objectContaining({ reason: expect.stringContaining('403') }),
    );
  });

  it('prevents upload before final approval', async () => {
    const fetchImpl = vi.fn();
    await expect(
      uploadApprovedVideo({ ...approvedJob, status: 'FINAL_APPROVAL' }, { fetchImpl }),
    ).rejects.toThrow('requires final approval');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
