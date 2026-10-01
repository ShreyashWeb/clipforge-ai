import { z } from 'zod';

const sceneSchema = z.object({
  sceneNo: z.number().int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
});

const scriptSchema = z.object({ scenes: z.array(sceneSchema).min(1) });
const checkSchema = z.object({
  line: z.number().int().positive(),
  supported: z.boolean(),
  reason: z.string().min(1),
});
const verificationSchema = z.object({ checks: z.array(checkSchema) });

const defaultLlm = {
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
            temperature: 0.3,
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
    throw new Error(`Script generation failed: ${lastError.message}`);
  },
};

function parseJson(content) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : text);
}

function sourceContext(sources) {
  return sources
    .map(
      (source, index) =>
        `[${source.id || index + 1}] ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet}`,
    )
    .join('\n\n');
}

function sourceIds(sources) {
  return new Set(sources.map((source, index) => String(source.id || index + 1)));
}

function validateScript(script, sources) {
  const parsed = scriptSchema.parse(script);
  const ids = sourceIds(sources);
  for (const scene of parsed.scenes) {
    if (scene.sourceIds.some((id) => !ids.has(id))) {
      throw new Error(`Script scene ${scene.sceneNo} cites an unknown source`);
    }
  }
  return parsed;
}

function estimatedSeconds(script) {
  const words = script.scenes.reduce(
    (total, scene) => total + scene.narration.trim().split(/\s+/).length,
    0,
  );
  return words / 2.5;
}

function generationPrompt(topic, sources, context = '') {
  return `Write a source-grounded 30 to 45 second video script about "${topic}".
Return JSON only: {"scenes":[{"sceneNo":1,"narration":"...","visualPrompt":"...","sourceIds":["1"]}]}.
Create 4 to 8 scenes. Every factual claim in narration MUST be directly supported by
the cited source snippet, and every scene must cite at least one source ID. Do not
invent facts, numbers, dates, or causal claims. Keep the total narration between
75 and 112 words. Use the actual snippets, not general knowledge.
${context ? `REPAIR THESE UNSUPPORTED LINES:\n${context}\n` : ''}
RESEARCH:
${sourceContext(sources)}`;
}

function verificationPrompt(topic, script, sources) {
  return `Audit each narration line in this script about "${topic}" against only the
cited source snippets. Return JSON only:
{"checks":[{"line":1,"supported":true,"reason":"..."}]}.
Use one check per scene. Mark supported false if any factual claim is not entailed
by the cited snippets. Explain the exact missing or contradicted evidence.

SCRIPT:
${JSON.stringify(script)}

SOURCES:
${sourceContext(sources)}`;
}

/**
 * Generates and verifies a source-grounded 30-45 second script, repairing unsupported
 * scenes once before returning visible support flags.
 *
 * @param {string} topic
 * @param {{ sources: object[], llm?: { generate: (prompt: string) => Promise<string|object> }, angle?: string }} options
 * @returns {Promise<{scenes: object[], checks: object[], unsupportedLines: object[], durationSeconds: number}>}
 */
export async function generateScript(
  topic,
  { sources, llm = defaultLlm, angle = '' } = {},
) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('Script generation requires research sources');
  }

  const initial = validateScript(
    parseJson(await llm.generate(generationPrompt(topic, sources, angle ? `Preferred angle: ${angle}` : ''))),
    sources,
  );
  if (estimatedSeconds(initial) < 30 || estimatedSeconds(initial) > 45) {
    throw new Error('Generated script is not between 30 and 45 seconds');
  }

  let script = initial;
  let checks = verificationSchema
    .parse(parseJson(await llm.generate(verificationPrompt(topic, script, sources))))
    .checks;
  let unsupported = checks.filter((check) => !check.supported);

  if (unsupported.length) {
    const repaired = validateScript(
      parseJson(
        await llm.generate(
          generationPrompt(
            topic,
            sources,
            unsupported.map((check) => `Line ${check.line}: ${check.reason}`).join('\n'),
          ),
        ),
      ),
      sources,
    );
    if (estimatedSeconds(repaired) < 30 || estimatedSeconds(repaired) > 45) {
      throw new Error('Regenerated script is not between 30 and 45 seconds');
    }
    script = repaired;
    checks = verificationSchema
      .parse(parseJson(await llm.generate(verificationPrompt(topic, script, sources))))
      .checks;
    unsupported = checks.filter((check) => !check.supported);
  }

  return {
    scenes: script.scenes,
    checks,
    unsupportedLines: unsupported,
    durationSeconds: estimatedSeconds(script),
  };
}

export { scriptSchema, verificationSchema };
