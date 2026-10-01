import { describe, expect, it, vi } from 'vitest';
import { researchTopic } from '../src/services/research.js';

function cacheModel(cached = null) {
  return {
    findOne: vi.fn(async () => cached),
    findOneAndUpdate: vi.fn(async (_query, update) => update),
  };
}

describe('research service', () => {
  it('returns normalized results, de-duplicated by domain, and caches them', async () => {
    const cache = cacheModel();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { title: 'One', url: 'https://www.example.com/one', content: 'First', published_date: '2026-01-01' },
          { title: 'Duplicate', url: 'https://example.com/two', content: 'Second' },
          { title: 'Two', url: 'https://news.example.org/story', content: 'Third' },
        ],
      }),
    }));

    const results = await researchTopic('battery storage', {
      apiKey: 'test-key',
      cacheModel: cache,
      fetchImpl,
      sleep: vi.fn(),
    });

    expect(results).toEqual([
      { title: 'One', url: 'https://www.example.com/one', snippet: 'First', publishedDate: '2026-01-01' },
      { title: 'Two', url: 'https://news.example.org/story', snippet: 'Third', publishedDate: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(cache.findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it('returns a valid unexpired cache without calling Tavily', async () => {
    const cached = { results: [{ title: 'Cached', url: 'https://example.com', snippet: 'Saved', publishedDate: null }] };
    const fetchImpl = vi.fn();
    const results = await researchTopic('cached topic', {
      apiKey: 'test-key',
      cacheModel: cacheModel(cached),
      fetchImpl,
    });

    expect(results[0].title).toBe('Cached');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries rate limits with exponential backoff', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    const sleep = vi.fn(async () => {});

    await researchTopic('rate limited topic', {
      apiKey: 'test-key',
      cacheModel: cacheModel(),
      fetchImpl,
      sleep,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('fails clearly when the API key is missing', async () => {
    await expect(researchTopic('topic', { apiKey: '' })).rejects.toThrow(
      'TAVILY_API_KEY is not configured',
    );
  });
});
