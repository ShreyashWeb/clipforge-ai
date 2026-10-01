import { describe, expect, it, vi } from 'vitest';
import { generateScript } from '../src/pipeline/script.js';

const sources = [
  { id: '1', title: 'Energy report', url: 'https://example.com/energy', snippet: 'Batteries store electricity for later use.' },
  { id: '2', title: 'Grid report', url: 'https://example.org/grid', snippet: 'Storage can help balance demand.' },
];

const longNarration = (text) => `${text} `.repeat(16).trim();

describe('script pipeline', () => {
  it('generates, verifies, and returns source support flags', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          scenes: [
            { sceneNo: 1, narration: longNarration('Batteries store electricity for later use.'), visualPrompt: 'Battery cells', sourceIds: ['1'] },
          ],
        }),
      )
      .mockResolvedValueOnce(JSON.stringify({ checks: [{ line: 1, supported: true, reason: 'Matches the snippet.' }] }));

    const result = await generateScript('Battery storage', { sources, llm: { generate } });
    expect(result.scenes[0].sourceIds).toEqual(['1']);
    expect(result.unsupportedLines).toEqual([]);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(30);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('regenerates unsupported lines once and returns remaining flags', async () => {
    const makeScript = (text) => JSON.stringify({
      scenes: [{ sceneNo: 1, narration: longNarration(text), visualPrompt: 'Grid storage', sourceIds: ['2'] }],
    });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(makeScript('Storage eliminates all blackouts safely.'))
      .mockResolvedValueOnce(JSON.stringify({ checks: [{ line: 1, supported: false, reason: 'The snippet does not claim this.' }] }))
      .mockResolvedValueOnce(makeScript('Storage can help balance demand.'))
      .mockResolvedValueOnce(JSON.stringify({ checks: [{ line: 1, supported: true, reason: 'Matches the snippet.' }] }));

    const result = await generateScript('Grid storage', { sources, llm: { generate } });
    expect(result.scenes[0].narration).toContain('Storage can help balance demand.');
    expect(result.unsupportedLines).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it('rejects citations to sources outside the research set', async () => {
    const generate = vi.fn(async () =>
      JSON.stringify({
        scenes: [{ sceneNo: 1, narration: longNarration('A claim.'), visualPrompt: 'Visual', sourceIds: ['99'] }],
      }),
    );
    await expect(generateScript('Topic', { sources, llm: { generate } })).rejects.toThrow(
      'unknown source',
    );
  });
});
