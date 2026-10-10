import { z } from 'zod';

const defaultGeminiModel = process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'gemini-2.0-flash-lite';
const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
const maxAttempts = 3;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * In-memory sequential rate-limit queue for LLM calls to respect provider RPM/TPM.
 */
class RateLimitQueue {
  constructor(minIntervalMs = 100) {
    this.minIntervalMs = minIntervalMs;
    this.lastCallTime = 0;
    this.queue = Promise.resolve();
  }

  enqueue(fn) {
    const run = async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastCallTime;
      if (timeSinceLast < this.minIntervalMs) {
        await wait(this.minIntervalMs - timeSinceLast);
      }
      this.lastCallTime = Date.now();
      return fn();
    };

    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }
}

export const defaultRateLimitQueue = new RateLimitQueue(150);

/**
 * Normalizes input parts into Gemini multimodal content parts.
 * Supports strings, image buffers/base64, audio buffers/base64, and raw parts.
 *
 * @param {Array<string|object>|string} input
 * @returns {Array<object>}
 */
export function normalizeMultimodalParts(input) {
  if (typeof input === 'string') {
    return [{ text: input }];
  }

  if (Array.isArray(input)) {
    return input.map((part) => {
      if (typeof part === 'string') {
        return { text: part };
      }

      if (part.type === 'text' || part.text) {
        return { text: part.text || part.content || '' };
      }

      if (part.type === 'image' || part.image) {
        const data = part.data || part.base64 || part.image;
        const base64 = Buffer.isBuffer(data) ? data.toString('base64') : String(data).replace(/^data:image\/[a-z]+;base64,/, '');
        return {
          inlineData: {
            mimeType: part.mimeType || 'image/jpeg',
            data: base64,
          },
        };
      }

      if (part.type === 'audio' || part.audio) {
        const data = part.data || part.base64 || part.audio;
        const base64 = Buffer.isBuffer(data) ? data.toString('base64') : String(data).replace(/^data:audio\/[a-z]+;base64,/, '');
        return {
          inlineData: {
            mimeType: part.mimeType || 'audio/mp3',
            data: base64,
          },
        };
      }

      return part;
    });
  }

  return [{ text: String(input) }];
}

/**
 * Gemini Multimodal LLM Provider implementation.
 */
export class GeminiLlmProvider {
  /**
   * @param {{
   *   apiKey?: string,
   *   model?: string,
   *   fetchImpl?: typeof fetch,
   *   timeoutMs?: number,
   *   queue?: RateLimitQueue
   * }} options
   */
  constructor({
    apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY,
    model = defaultGeminiModel,
    fetchImpl = fetch,
    timeoutMs = 30000,
    queue = defaultRateLimitQueue,
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.queue = queue;
  }

  /**
   * Generates content from text or multimodal parts, with optional Zod schema validation
   * and automatic execution trace logging into the job object.
   *
   * @param {string|Array<string|object>} input
   * @param {{
   *   schema?: import('zod').ZodTypeAny,
   *   systemInstruction?: string,
   *   temperature?: number,
   *   job?: object,
   *   stepName?: string,
   *   timeoutMs?: number
   * }} options
   * @returns {Promise<any>}
   */
  async generate(input, options = {}) {
    const {
      schema,
      systemInstruction,
      temperature = 0.3,
      job,
      stepName = 'LLM_GENERATE',
      timeoutMs = this.timeoutMs,
    } = options;

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY or LLM_API_KEY is not configured');
    }

    const parts = normalizeMultimodalParts(input);
    const endpoint = `${geminiBaseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${this.apiKey}`;
    const startTime = Date.now();

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature,
        ...(schema ? { responseMimeType: 'application/json' } : {}),
      },
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
    };

    const executeCall = async () => {
      let lastError;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const msg = errorPayload?.error?.message || `Gemini request failed with status ${response.status}`;
            const error = new Error(msg);
            if (response.status !== 429 && response.status < 500) throw error;
            lastError = error;
          } else {
            const payload = await response.json();
            const textResult = payload.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = payload.usageMetadata || {};
            const ms = Date.now() - startTime;

            // Log trace to job if provided
            if (job && Array.isArray(job.trace)) {
              job.trace.push({
                step: stepName,
                tool: `gemini:${this.model}`,
                ms,
                ok: true,
                at: new Date(),
              });
            }

            if (schema) {
              const cleaned = textResult.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
              const parsedJson = JSON.parse(cleaned || '{}');
              return schema.parse(parsedJson);
            }

            return textResult;
          }
        } catch (error) {
          lastError = error.name === 'AbortError' ? new Error('Gemini request timed out') : error;
          if (error.name === 'ZodError' || error.name === 'SyntaxError') {
            throw error;
          }
        } finally {
          clearTimeout(timeout);
        }

        if (attempt < maxAttempts - 1) {
          await wait(250 * 2 ** attempt);
        }
      }

      const ms = Date.now() - startTime;
      if (job && Array.isArray(job.trace)) {
        job.trace.push({
          step: stepName,
          tool: `gemini:${this.model}`,
          ms,
          ok: false,
          at: new Date(),
        });
      }

      throw new Error(`Gemini generation failed after ${maxAttempts} attempts: ${lastError?.message || 'unknown error'}`);
    };

    return this.queue ? this.queue.enqueue(executeCall) : executeCall();
  }
}

/**
 * Mock LLM Provider for unit testing.
 */
export class MockLlmProvider {
  /**
   * @param {Record<string, any>|Array<any>|((input: any) => any)} responses
   */
  constructor(responses = {}) {
    this.responses = responses;
    this.calls = [];
  }

  async generate(input, options = {}) {
    const { schema, job, stepName = 'LLM_GENERATE' } = options;
    const startTime = Date.now();
    this.calls.push({ input, options, timestamp: startTime });

    let result;
    if (typeof this.responses === 'function') {
      result = await this.responses(input, options);
    } else if (Array.isArray(this.responses)) {
      result = this.responses.shift();
    } else {
      result = this.responses;
    }

    const ms = Date.now() - startTime;
    if (job && Array.isArray(job.trace)) {
      job.trace.push({
        step: stepName,
        tool: 'mock-llm',
        ms,
        ok: true,
        at: new Date(),
      });
    }

    if (schema && typeof result === 'object') {
      return schema.parse(result);
    }

    if (schema && typeof result === 'string') {
      const cleaned = result.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
      return schema.parse(JSON.parse(cleaned));
    }

    return result;
  }
}

export const defaultLlm = new GeminiLlmProvider();
