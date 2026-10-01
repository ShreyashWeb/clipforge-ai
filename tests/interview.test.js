import { describe, expect, it, vi } from 'vitest';
import { createInterviewPlan, recordInterviewAnswer } from '../src/pipeline/interview.js';

const sources = [
  {
    title: 'Battery report',
    url: 'https://example.com/batteries',
    snippet: 'Grid batteries can shift renewable electricity into evening demand.',
    publishedDate: '2026-01-01',
  },
];

describe('interview pipeline', () => {
  it('uses research in the LLM prompt and validates structured output', async () => {
    const generate = vi.fn(async (prompt) => {
      expect(prompt).toContain('Grid batteries can shift renewable electricity');
      expect(prompt).toContain('https://example.com/batteries');
      return JSON.stringify({
        questions: [
          { key: 'audience', question: 'Should we explain the evening demand shift to homeowners or grid operators?' },
          { key: 'uniqueAngle', question: 'Should we focus on the report claim about shifting electricity into evening demand?' },
          { key: 'tone', question: 'Should the battery evidence be presented as a breakthrough or a practical trade-off?' },
        ],
        hooks: [
          'The sun sets, but the grid still needs power.',
          'What happens to clean energy after sunset?',
        ],
        angles: [
          'How batteries move clean energy to the hours people need it.',
          'Why evening demand changes the battery equation.',
          'The practical trade-off behind storing renewable power.',
        ],
      });
    });

    const result = await createInterviewPlan('Grid batteries', {
      sources,
      llm: { generate },
    });

    expect(result.sources).toEqual(sources);
    expect(result.questions).toHaveLength(3);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('rejects malformed model output', async () => {
    await expect(
      createInterviewPlan('Topic', {
        sources,
        llm: { generate: async () => '{"questions":[],"hooks":[],"angles":[]}' },
      }),
    ).rejects.toThrow();
  });

  it('stores answers one at a time and reports the next question', () => {
    const job = {
      hooks: ['Hook 1', 'Hook 2'],
      interviewAnswers: {
        questions: [
          { key: 'audience', question: 'Who is this for?' },
          { key: 'uniqueAngle', question: 'What is the angle?' },
          { key: 'tone', question: 'What tone?' },
        ],
        angles: ['Angle 1', 'Angle 2', 'Angle 3'],
        answers: {},
      },
    };

    expect(recordInterviewAnswer(job, 'Beginners')).toEqual({
      complete: false,
      nextQuestion: { key: 'uniqueAngle', question: 'What is the angle?' },
    });
    expect(recordInterviewAnswer(job, 'Evidence first')).toEqual({
      complete: false,
      nextQuestion: { key: 'tone', question: 'What tone?' },
    });
    expect(recordInterviewAnswer(job, 'Warm')).toEqual({
      complete: true,
      nextQuestion: null,
    });
    expect(job.interviewAnswers.answers).toEqual({
      audience: 'Beginners',
      uniqueAngle: 'Evidence first',
      tone: 'Warm',
    });
  });
});
