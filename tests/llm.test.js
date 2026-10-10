import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  GeminiLlmProvider,
  MockLlmProvider,
  normalizeMultimodalParts,
} from '../src/services/llm.js';

describe('LLM Service', () => {
  describe('normalizeMultimodalParts', () => {
    it('normalizes simple string prompt into text part', () => {
      const parts = normalizeMultimodalParts('Hello world');
      expect(parts).toEqual([{ text: 'Hello world' }]);
    });

    it('normalizes image and audio parts into Gemini inlineData', () => {
      const parts = normalizeMultimodalParts([
        { type: 'text', text: 'Analyze this image and audio' },
        { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUg==' },
        { type: 'audio', mimeType: 'audio/mp3', data: 'SUQzBAAAAAAAI1RTU0UAAAAO' },
      ]);

      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ text: 'Analyze this image and audio' });
      expect(parts[1]).toEqual({
        inlineData: {
          mimeType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUg==',
        },
      });
      expect(parts[2]).toEqual({
        inlineData: {
          mimeType: 'audio/mp3',
          data: 'SUQzBAAAAAAAI1RTU0UAAAAO',
        },
      });
    });
  });

  describe('GeminiLlmProvider', () => {
    it('generates structured JSON output validated with Zod schema', async () => {
      const testSchema = z.object({
        title: z.string(),
        hooks: z.array(z.string()).min(1),
      });

      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'YOLOv11 Architecture',
                      hooks: ['Detect 80 objects in 6ms.'],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 20 },
        }),
      });

      const provider = new GeminiLlmProvider({
        apiKey: 'test-api-key',
        fetchImpl: mockFetch,
        queue: null, // direct for test
      });

      const mockJob = { trace: [] };
      const output = await provider.generate('Generate video hooks', {
        schema: testSchema,
        job: mockJob,
        stepName: 'HOOK_GENERATION',
      });

      expect(output.title).toBe('YOLOv11 Architecture');
      expect(output.hooks).toHaveLength(1);
      expect(mockJob.trace).toHaveLength(1);
      expect(mockJob.trace[0].step).toBe('HOOK_GENERATION');
      expect(mockJob.trace[0].ok).toBe(true);
      expect(mockJob.trace[0].tool).toContain('gemini:');
    });

    it('retries on 503 transient errors with backoff', async () => {
      let attempts = 0;
      const mockFetch = async () => {
        attempts += 1;
        if (attempts === 1) {
          return { ok: false, status: 503, json: async () => ({ error: { message: 'Service Unavailable' } }) };
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Recovered response' }] } }],
          }),
        };
      };

      const provider = new GeminiLlmProvider({
        apiKey: 'test-api-key',
        fetchImpl: mockFetch,
        queue: null,
      });

      const result = await provider.generate('Testing retry');
      expect(result).toBe('Recovered response');
      expect(attempts).toBe(2);
    });

    it('throws error when API key is missing', async () => {
      const provider = new GeminiLlmProvider({ apiKey: '' });
      await expect(provider.generate('Prompt')).rejects.toThrow(/GEMINI_API_KEY/);
    });
  });

  describe('MockLlmProvider', () => {
    it('returns canned structured response and populates job trace', async () => {
      const testSchema = z.object({
        status: z.string(),
        count: z.number(),
      });

      const mockProvider = new MockLlmProvider({
        status: 'ready',
        count: 42,
      });

      const mockJob = { trace: [] };
      const res = await mockProvider.generate('Test prompt', {
        schema: testSchema,
        job: mockJob,
        stepName: 'MOCK_TEST',
      });

      expect(res).toEqual({ status: 'ready', count: 42 });
      expect(mockJob.trace).toHaveLength(1);
      expect(mockJob.trace[0].step).toBe('MOCK_TEST');
      expect(mockJob.trace[0].tool).toBe('mock-llm');
    });
  });
});
