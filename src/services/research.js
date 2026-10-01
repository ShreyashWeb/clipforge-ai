import { ResearchCache } from '../models/ResearchCache.js';

const tavilyEndpoint = 'https://api.tavily.com/search';
const cacheLifetimeMs = 24 * 60 * 60 * 1000;
const maxAttempts = 3;

function domainFor(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeResults(items, limit) {
  const domains = new Set();
  const results = [];

  for (const item of items) {
    const url = typeof item.url === 'string' ? item.url : '';
    const domain = domainFor(url);
    if (!url || !domain || domains.has(domain)) continue;

    domains.add(domain);
    results.push({
      title: item.title || '',
      url,
      snippet: item.content || item.snippet || '',
      publishedDate: item.published_date || item.publishedDate || null,
    });
    if (results.length === limit) break;
  }

  return results;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchTavily(topic, apiKey, fetchImpl, timeoutMs, sleep) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(tavilyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: topic,
          search_depth: 'advanced',
          max_results: 10,
        }),
        signal: controller.signal,
      });

      if (response.ok) return response.json();

      const error = new Error(`Tavily search failed with status ${response.status}`);
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      if (error.name !== 'AbortError' && !lastError) lastError = error;
      if (error.name === 'AbortError') lastError = new Error('Tavily search timed out');
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < maxAttempts - 1) await sleep(250 * 2 ** attempt);
  }

  throw new Error(`Tavily search failed after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Searches Tavily and caches normalized, domain-diverse results for 24 hours.
 *
 * @param {string} topic
 * @param {{
 *   limit?: number,
 *   apiKey?: string,
 *   cacheModel?: typeof ResearchCache,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   sleep?: (milliseconds: number) => Promise<void>
 * }} options
 * @returns {Promise<Array<{title: string, url: string, snippet: string, publishedDate: string|null}>>}
 */
export async function researchTopic(
  topic,
  {
    limit = 5,
    apiKey = process.env.TAVILY_API_KEY,
    cacheModel = ResearchCache,
    fetchImpl = fetch,
    timeoutMs = 10000,
    sleep = wait,
  } = {},
) {
  if (!topic || !topic.trim()) throw new Error('Research topic is required');
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured');

  const query = topic.trim();
  const cached = await cacheModel.findOne({ query, expiresAt: { $gt: new Date() } });
  if (cached) return cached.results.slice(0, limit);

  const payload = await fetchTavily(query, apiKey, fetchImpl, timeoutMs, sleep);
  const results = normalizeResults(payload.results || [], limit);
  await cacheModel.findOneAndUpdate(
    { query },
    { query, results, expiresAt: new Date(Date.now() + cacheLifetimeMs) },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return results;
}
