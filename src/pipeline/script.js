import { z } from 'zod';
import { defaultLlm as fallbackLlm } from '../services/llm.js';

const sceneSchema = z.object({
  sceneNo: z.number().int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  supported: z.boolean().optional(),
});

const scriptSchema = z.object({ scenes: z.array(sceneSchema).min(1) });

const checkSchema = z.object({
  line: z.number().int().positive(),
  supported: z.boolean(),
  quote: z.string().optional(),
  reason: z.string().min(1),
});

const verificationSchema = z.object({ checks: z.array(checkSchema) });

function parseJson(content) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : text);
}

function sourceContext(sources) {
  return sources
    .map(
      (source, index) =>
        `[${source.id || index + 1}] ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet || source.content || ''}`,
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
{"checks":[{"line":1,"supported":true,"quote":"direct quote from snippet","reason":"..."}]}.
Use one check per scene. If supported is true, you MUST provide an exact verbatim quote from the cited snippet.
Mark supported false if any claim is not entailed by the cited snippet or if no direct quote exists.

SCRIPT:
${JSON.stringify(script)}

SOURCES:
${sourceContext(sources)}`;
}

/**
 * Validates that cited quotes actually exist in the research source snippets.
 *
 * @param {Array<object>} checks
 * @param {Array<object>} scenes
 * @param {Array<object>} sources
 * @returns {Array<object>}
 */
function verifyQuotesAgainstSources(checks, scenes, sources) {
  return checks.map((check) => {
    const scene = scenes.find((s) => s.sceneNo === check.line) || scenes[check.line - 1];
    if (!scene) return check;

    // If check claims supported and provided a quote, verify it appears in at least one cited snippet
    if (check.supported && check.quote && check.quote.trim().length > 3) {
      const citedSources = sources.filter((s, idx) =>
        scene.sourceIds.includes(String(s.id || idx + 1)),
      );
      const quoteText = check.quote.trim().toLowerCase();
      const quoteAppearsInSnippet = citedSources.some((s) => {
        const snippet = (s.snippet || s.content || '').toLowerCase();
        return snippet.includes(quoteText);
      });

      if (!quoteAppearsInSnippet && citedSources.length > 0) {
        return {
          ...check,
          supported: false,
          reason: `Verification quote "${check.quote}" does not appear in the cited source snippet.`,
        };
      }
    }

    return check;
  });
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
  { sources, llm = fallbackLlm, angle = '' } = {},
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
  const rawChecks = verificationSchema
    .parse(parseJson(await llm.generate(verificationPrompt(topic, script, sources))))
    .checks;
  let checks = verifyQuotesAgainstSources(rawChecks, script.scenes, sources);
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
    const reChecked = verificationSchema
      .parse(parseJson(await llm.generate(verificationPrompt(topic, script, sources))))
      .checks;
    checks = verifyQuotesAgainstSources(reChecked, script.scenes, sources);
    unsupported = checks.filter((check) => !check.supported);
  }

  // Attach supported flag to each scene
  const scenesWithFlags = script.scenes.map((scene) => {
    const check = checks.find((c) => c.line === scene.sceneNo);
    return {
      ...scene,
      supported: check ? check.supported : true,
    };
  });

  return {
    scenes: scenesWithFlags,
    checks,
    unsupportedLines: unsupported,
    durationSeconds: estimatedSeconds(script),
  };
}

export { scriptSchema, verificationSchema };
