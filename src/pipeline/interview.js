import { z } from 'zod';
import { researchTopic } from '../services/research.js';

const interviewSchema = z.object({
  questions: z
    .array(
      z.object({
        key: z.enum(['audience', 'uniqueAngle', 'tone']),
        question: z.string().min(1),
      }),
    )
    .length(3),
  hooks: z.array(z.string().min(1)).length(2),
  angles: z.array(z.string().min(1)).length(3),
});

export const defaultLlm = {
  async generate(prompt) {
    const endpoint = process.env.LLM_API_URL;
    const apiKey = process.env.LLM_API_KEY;
    if (!endpoint || !apiKey) throw new Error('LLM_API_URL and LLM_API_KEY are required');

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`LLM request failed with status ${response.status}`);
        const payload = await response.json();
        return payload.choices?.[0]?.message?.content || payload.output_text;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`LLM interview generation failed: ${lastError.message}`);
  },
};

function researchContext(sources) {
  return sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\nURL: ${source.url}\nPublished: ${
          source.publishedDate || 'unknown'
        }\nEvidence: ${source.snippet}`,
    )
    .join('\n\n');
}

function parseJson(content) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : text);
}

/**
 * Researches a topic and asks the LLM for source-grounded interview content.
 *
 * @param {string} topic
 * @param {{ research?: (topic: string) => Promise<object[]>, llm?: { generate: (prompt: string) => Promise<string|object> }, sources?: object[] }} options
 * @returns {Promise<{sources: object[], questions: object[], hooks: string[], angles: string[]}>}
 */
export async function createInterviewPlan(
  topic,
  { research = researchTopic, llm = defaultLlm, sources } = {},
) {
  const actualSources = sources || (await research(topic));
  if (!actualSources.length) {
    throw new Error('Interview cannot be generated without research sources');
  }

  const prompt = `You are preparing a short, source-grounded video about "${topic}".
Use the actual research below. Do not ask generic questions: every question must refer
to a concrete claim, contrast, or gap in these sources. Return JSON only with exactly:
{"questions":[{"key":"audience|uniqueAngle|tone","question":"..."}],
"hooks":["...","..."],"angles":["...","...","..."]}.
Questions must be one each for audience, uniqueAngle, and tone, in that order.
Hooks and angles must be specific to the evidence and links below.

RESEARCH:
${researchContext(actualSources)}`;

  const raw = await llm.generate(prompt);
  const plan = interviewSchema.parse(parseJson(raw));
  return { sources: actualSources, ...plan };
}

/**
 * Stores one interview answer and reports whether the interview is complete.
 *
 * @param {object} job
 * @param {string} answer
 * @returns {{complete: boolean, nextQuestion: object|null}}
 */
export function recordInterviewAnswer(job, answer) {
  const plan = interviewSchema.parse({
    questions: job.interviewAnswers?.questions,
    hooks: job.hooks,
    angles: job.interviewAnswers?.angles,
  });
  const answers = job.interviewAnswers.answers || {};
  const nextQuestion = plan.questions.find((question) => !answers[question.key]);
  if (!nextQuestion) return { complete: true, nextQuestion: null };
  answers[nextQuestion.key] = answer.trim();
  job.interviewAnswers = { ...job.interviewAnswers, answers };
  const following = plan.questions.find((question) => !answers[question.key]);
  return { complete: !following, nextQuestion: following || null };
}

export { interviewSchema };
