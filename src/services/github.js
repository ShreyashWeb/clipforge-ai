import { Octokit } from '@octokit/rest';
import { z } from 'zod';

const maxAttempts = 3;
const defaultTimeoutMs = 10000;

const explainerSchema = z.object({
  whatChanged: z.string().min(1),
  whyItMatters: z.string().min(1),
});

/**
 * Parses supported GitHub repository, pull request, and release URLs.
 *
 * @param {string} value
 * @returns {{owner: string, repo: string, kind: 'repository'|'pull'|'release', number?: number, tag?: string}}
 */
export function parseGitHubUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('A valid GitHub repository, pull request, or release URL is required');
  }

  if (parsed.hostname.toLowerCase() !== 'github.com') {
    throw new Error('GitHub URLs must use github.com');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0].includes('.') || parts[1].includes('.')) {
    throw new Error('GitHub URL must include an owner and repository');
  }

  const [owner, repo] = parts.slice(0, 2);
  if (parts.length === 2) return { owner, repo, kind: 'repository' };
  if (parts[2] === 'pull' && /^\d+$/.test(parts[3] || '')) {
    return { owner, repo, kind: 'pull', number: Number(parts[3]) };
  }
  if (parts[2] === 'releases' && parts[3] === 'tag' && parts[4]) {
    return { owner, repo, kind: 'release', tag: decodeURIComponent(parts.slice(4).join('/')) };
  }

  throw new Error('Unsupported GitHub URL. Use a repository, pull request, or release URL');
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestWithRetry(request, { timeoutMs, sleep }) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await request({ request: { timeout: timeoutMs } });
    } catch (error) {
      lastError = error;
      const status = error.status || error.response?.status;
      if (status && status < 500 && status !== 429) throw error;
      if (attempt < maxAttempts - 1) await sleep(250 * 2 ** attempt);
    }
  }
  throw new Error(`GitHub API request failed after ${maxAttempts} attempts: ${lastError.message}`);
}

function source(id, title, url, snippet, publishedDate = null) {
  return { id, title, url, snippet: snippet.slice(0, 4000), publishedDate };
}

function decodeReadme(content) {
  if (!content) return '';
  return Buffer.from(content, 'base64').toString('utf8');
}

function commitUrl(owner, repo, sha) {
  return `https://github.com/${owner}/${repo}/commit/${sha}`;
}

/**
 * Gathers GitHub evidence and returns the canonical research source format.
 *
 * @param {string} url
 * @param {{token?: string, octokit?: import('@octokit/rest').Octokit, timeoutMs?: number, sleep?: (ms: number) => Promise<void>}} options
 * @returns {Promise<Array<{id: string, title: string, url: string, snippet: string, publishedDate: string|null}>>}
 */
export async function researchGitHub(
  url,
  {
    token = process.env.GITHUB_TOKEN,
    octokit = new Octokit(token ? { auth: token } : {}),
    timeoutMs = defaultTimeoutMs,
    sleep = delay,
  } = {},
) {
  const target = parseGitHubUrl(url);
  const options = { timeoutMs, sleep };
  const sources = [];
  const repoUrl = `https://github.com/${target.owner}/${target.repo}`;

  const repository = await requestWithRetry(
    (requestOptions) => octokit.rest.repos.get({ owner: target.owner, repo: target.repo, ...requestOptions }),
    options,
  );
  const readme = await requestWithRetry(
    (requestOptions) =>
      octokit.rest.repos.getReadme({ owner: target.owner, repo: target.repo, ...requestOptions }),
    options,
  ).catch((error) => {
    if (error.status === 404) return null;
    throw error;
  });

  if (readme) {
    sources.push(source('github:readme', `${repository.data.full_name} README`, readme.data.html_url || `${repoUrl}#readme`, decodeReadme(readme.data.content), repository.data.updated_at));
  }

  const commits = await requestWithRetry(
    (requestOptions) =>
      octokit.rest.repos.listCommits({ owner: target.owner, repo: target.repo, per_page: 5, ...requestOptions }),
    options,
  );
  for (const commit of commits.data) {
    sources.push(
      source(
        `github:commit:${commit.sha}`,
        `Commit: ${commit.commit.message.split('\n')[0]}`,
        commit.html_url || commitUrl(target.owner, target.repo, commit.sha),
        `${commit.commit.message}\nAuthor: ${commit.commit.author?.name || 'unknown'}`,
        commit.commit.author?.date || null,
      ),
    );
  }

  if (target.kind === 'pull') {
    const pull = await requestWithRetry(
      (requestOptions) =>
        octokit.rest.pulls.get({ owner: target.owner, repo: target.repo, pull_number: target.number, ...requestOptions }),
      options,
    );
    sources.push(source(`github:pull:${target.number}`, `Pull request: ${pull.data.title}`, pull.data.html_url, pull.data.body || 'No pull request description.', pull.data.updated_at));
    const files = await requestWithRetry(
      (requestOptions) =>
        octokit.rest.pulls.listFiles({ owner: target.owner, repo: target.repo, pull_number: target.number, per_page: 100, ...requestOptions }),
      options,
    );
    for (const file of files.data) {
      sources.push(source(`github:file:${file.sha || file.filename}`, `Changed file: ${file.filename}`, pull.data.html_url, `${file.status}: +${file.additions} -${file.deletions}\n${file.patch || 'Binary or patch unavailable.'}`, pull.data.updated_at));
    }
  }

  if (target.kind === 'release') {
    const release = await requestWithRetry(
      (requestOptions) =>
        octokit.rest.repos.getReleaseByTag({ owner: target.owner, repo: target.repo, tag: target.tag, ...requestOptions }),
      options,
    );
    sources.push(source(`github:release:${target.tag}`, `Release: ${release.data.name || target.tag}`, release.data.html_url, release.data.body || 'No release notes.', release.data.published_at || null));
  }

  return sources;
}

/**
 * Produces a concise, source-grounded explanation of a GitHub change.
 *
 * @param {Array<object>} sources
 * @param {{generate: (prompt: string) => Promise<string|object>}} llm
 * @returns {Promise<{whatChanged: string, whyItMatters: string}>}
 */
export async function explainGitHubChange(sources, llm) {
  if (!sources?.length) throw new Error('GitHub change explanation requires research sources');
  if (!llm?.generate) throw new Error('An LLM is required to explain GitHub changes');
  const evidence = sources.map((item) => `[${item.id}] ${item.title}\n${item.snippet}`).join('\n\n');
  const raw = await llm.generate(`Using only the GitHub evidence below, return JSON with exactly {"whatChanged":"...","whyItMatters":"..."}. Cite concrete changes, avoid speculation, and explain practical impact.\n\n${evidence}`);
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return explainerSchema.parse(JSON.parse(fenced ? fenced[1] : text));
}
