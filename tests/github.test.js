import { describe, expect, it, vi } from 'vitest';
import { explainGitHubChange, parseGitHubUrl, researchGitHub } from '../src/services/github.js';

function octokitMock() {
  return {
    rest: {
      repos: {
        get: vi.fn(async () => ({ data: { full_name: 'acme/widget', updated_at: '2026-01-02T00:00:00Z' } })),
        getReadme: vi.fn(async () => ({
          data: {
            html_url: 'https://github.com/acme/widget#readme',
            content: Buffer.from('Widget README').toString('base64'),
          },
        })),
        listCommits: vi.fn(async () => ({
          data: [{
            sha: 'abc123',
            html_url: 'https://github.com/acme/widget/commit/abc123',
            commit: { message: 'Add fast mode\n\nDetails', author: { name: 'Ada', date: '2026-01-01' } },
          }],
        })),
      },
      pulls: {
        get: vi.fn(async () => ({
          data: {
            title: 'Improve rendering',
            body: 'This makes rendering faster.',
            html_url: 'https://github.com/acme/widget/pull/7',
            updated_at: '2026-01-03',
          },
        })),
        listFiles: vi.fn(async () => ({
          data: [{ filename: 'src/render.js', status: 'modified', additions: 4, deletions: 1, patch: '@@ -1 +1 @@' }],
        })),
      },
    },
  };
}

describe('github service', () => {
  it('parses repository, pull request, and release URLs', () => {
    expect(parseGitHubUrl('https://github.com/acme/widget')).toEqual({
      owner: 'acme', repo: 'widget', kind: 'repository',
    });
    expect(parseGitHubUrl('https://github.com/acme/widget/pull/7')).toMatchObject({
      owner: 'acme', repo: 'widget', kind: 'pull', number: 7,
    });
    expect(parseGitHubUrl('https://github.com/acme/widget/releases/tag/v1.2.0')).toMatchObject({
      owner: 'acme', repo: 'widget', kind: 'release', tag: 'v1.2.0',
    });
  });

  it('normalizes README, commits, pull request, and changed files', async () => {
    const octokit = octokitMock();
    const sources = await researchGitHub('https://github.com/acme/widget/pull/7', {
      octokit,
      sleep: vi.fn(),
    });

    expect(sources.map((item) => item.id)).toEqual([
      'github:readme',
      'github:commit:abc123',
      'github:pull:7',
      'github:file:src/render.js',
    ]);
    expect(sources[0].snippet).toBe('Widget README');
    expect(sources[3].snippet).toContain('modified: +4 -1');
  });

  it('retries rate limits and generates a grounded explainer', async () => {
    const octokit = octokitMock();
    octokit.rest.repos.get.mockRejectedValueOnce({ status: 429, message: 'rate limited' });
    const sleep = vi.fn(async () => {});
    const sources = await researchGitHub('https://github.com/acme/widget', { octokit, sleep });
    expect(octokit.rest.repos.get).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);

    const result = await explainGitHubChange(sources, {
      generate: async () => '{"whatChanged":"Added fast mode.","whyItMatters":"Renders complete sooner."}',
    });
    expect(result.whatChanged).toBe('Added fast mode.');
  });
});
