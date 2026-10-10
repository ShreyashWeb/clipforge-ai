import { z } from 'zod';
import { defaultLlm } from '../services/llm.js';
import { researchTopic } from '../services/research.js';
import { generateScript } from '../pipeline/script.js';
import { generateStoryboardImages } from '../services/imageGen.js';
import { generateStoryboardVoice } from '../services/voice.js';
import { renderJob } from '../services/render.js';
import { JOB_STATUSES } from '../pipeline/stateMachine.js';

const MAX_STEPS = 20;

const toolDecisionSchema = z.object({
  thought: z.string().min(1),
  tool: z.enum([
    'ask_user',
    'web_research',
    'write_script',
    'verify_claims',
    'make_storyboard',
    'synthesize_voice',
    'render_video',
    'request_approval',
    'deliver',
    'finish',
  ]),
  args: z.record(z.any()).default({}),
});

/**
 * Checks if a specific approval gate has been approved in job.approvals
 *
 * @param {object} job
 * @param {string} gate
 * @returns {boolean}
 */
function isGateApproved(job, gate) {
  return Array.isArray(job.approvals) &&
    job.approvals.some((a) => a.gate === gate && (a.decision === 'approved' || a.decision === 'approve'));
}

/**
 * Executes a single agent step within the tool-calling loop.
 *
 * @param {object} job
 * @param {{
 *   llm?: { generate: (input: any, options?: object) => Promise<any> },
 *   research?: typeof researchTopic,
 *   scriptGen?: typeof generateScript,
 *   storyboardGen?: typeof generateStoryboardImages,
 *   voiceGen?: typeof generateStoryboardVoice,
 *   renderer?: typeof renderJob,
 *   maxSteps?: number
 * }} options
 * @returns {Promise<{
 *   status: 'COMPLETED' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'MAX_STEPS_REACHED' | 'FAILED',
 *   job: object,
 *   stepsExecuted: number,
 *   lastAction: string,
 *   message: string
 * }>}
 */
export async function runAgentLoop(job, options = {}) {
  const {
    llm = defaultLlm,
    research = researchTopic,
    scriptGen = generateScript,
    storyboardGen = generateStoryboardImages,
    voiceGen = generateStoryboardVoice,
    renderer = renderJob,
    maxSteps = MAX_STEPS,
  } = options;

  let stepsExecuted = 0;
  let lastAction = '';

  job.trace = job.trace || [];
  job.approvals = job.approvals || [];
  job.sources = job.sources || [];
  job.interviewAnswers = job.interviewAnswers || {};

  while (stepsExecuted < maxSteps) {
    stepsExecuted += 1;

    // Construct state summary for the LLM tool selector
    const stateSummary = {
      status: job.status,
      topic: job.topic,
      sourcesCount: job.sources.length,
      hasScript: !!job.script,
      storyboardScenesCount: job.storyboard?.length || 0,
      hasAudio: !!(job.audio || job.audioUrl),
      hasVideo: !!job.videoUrl,
      approvals: job.approvals.map((a) => `${a.gate}:${a.decision}`),
      interviewComplete: !!(job.interviewAnswers?.answers && Object.keys(job.interviewAnswers.answers).length >= 2),
    };

    const prompt = `You are the ClipForge AI production agent orchestrator.
Analyze the current job state and choose the single best NEXT tool to execute.

JOB STATE:
${JSON.stringify(stateSummary, null, 2)}

AVAILABLE TOOLS:
- "ask_user": Ask the user an interview question for audience/angle/tone. Use when interview is incomplete.
- "web_research": Retrieve verified citations via Tavily. Use when sources are missing.
- "write_script": Draft source-grounded script scenes with citations. Use when sources exist but script is missing.
- "verify_claims": Check script against cited sources.
- "request_approval": Request human approval for "ANGLE_APPROVAL", "STORYBOARD_APPROVAL", or "FINAL_APPROVAL".
- "make_storyboard": Generate visual scene images. (REQUIRES ANGLE_APPROVAL approved).
- "synthesize_voice": Synthesize voice narration audio. (REQUIRES STORYBOARD_APPROVAL approved).
- "render_video": Render final short video. (REQUIRES STORYBOARD_APPROVAL approved).
- "deliver": Finalize and deliver the completed video. (REQUIRES FINAL_APPROVAL approved).
- "finish": Finish execution when video is delivered or waiting.

Return JSON matching:
{"thought": "reasoning...", "tool": "tool_name", "args": {}}`;

    let decision;
    try {
      decision = await llm.generate(prompt, {
        schema: toolDecisionSchema,
        job,
        stepName: 'AGENT_DECIDE_TOOL',
      });
    } catch (err) {
      return {
        status: 'FAILED',
        job,
        stepsExecuted,
        lastAction: 'llm_decision',
        message: `Agent reasoning failed: ${err.message}`,
      };
    }

    lastAction = decision.tool;
    const startStepTime = Date.now();

    // TOOL: finish
    if (decision.tool === 'finish') {
      return {
        status: job.status === JOB_STATUSES.DELIVERED || job.status === JOB_STATUSES.PUBLISHED ? 'COMPLETED' : 'WAITING_USER',
        job,
        stepsExecuted,
        lastAction: 'finish',
        message: 'Agent completed active run.',
      };
    }

    // TOOL: ask_user
    if (decision.tool === 'ask_user') {
      const question = decision.args?.question || 'What is your target audience and preferred visual tone?';
      job.interviewAnswers.latestQuestion = question;
      job.trace.push({
        step: 'ask_user',
        tool: 'agent',
        ms: Date.now() - startStepTime,
        ok: true,
        at: new Date(),
      });
      return {
        status: 'WAITING_USER',
        job,
        stepsExecuted,
        lastAction: 'ask_user',
        message: question,
      };
    }

    // TOOL: request_approval
    if (decision.tool === 'request_approval') {
      const gate = decision.args?.gate || (
        job.status === JOB_STATUSES.INTERVIEW ? 'ANGLE_APPROVAL' :
        job.status === JOB_STATUSES.SCRIPT ? 'STORYBOARD_APPROVAL' :
        job.status === JOB_STATUSES.RENDER ? 'FINAL_APPROVAL' : 'ANGLE_APPROVAL'
      );

      job.status = gate;

      job.trace.push({
        step: 'request_approval',
        tool: 'agent',
        ms: Date.now() - startStepTime,
        ok: true,
        at: new Date(),
      });

      return {
        status: 'WAITING_APPROVAL',
        job,
        stepsExecuted,
        lastAction: 'request_approval',
        message: `Awaiting human approval at gate: ${gate}`,
      };
    }

    // TOOL: web_research
    if (decision.tool === 'web_research') {
      const query = decision.args?.query || job.topic;
      try {
        const sources = await research(query);
        job.sources = sources;
        job.trace.push({
          step: 'web_research',
          tool: 'tavily',
          ms: Date.now() - startStepTime,
          ok: true,
          at: new Date(),
        });
      } catch (err) {
        job.trace.push({ step: 'web_research', tool: 'tavily', ms: Date.now() - startStepTime, ok: false, at: new Date() });
        return { status: 'FAILED', job, stepsExecuted, lastAction: 'web_research', message: err.message };
      }
      continue;
    }

    // TOOL: write_script
    if (decision.tool === 'write_script') {
      if (!job.sources?.length) {
        // Must research first
        const sources = await research(job.topic);
        job.sources = sources;
      }
      try {
        const scriptResult = await scriptGen(job.topic, {
          sources: job.sources,
          angle: job.selectedAngle || job.angle || '',
          llm,
        });
        job.script = scriptResult.scenes || scriptResult;
        job.status = JOB_STATUSES.SCRIPT;
        job.trace.push({
          step: 'write_script',
          tool: 'llm',
          ms: Date.now() - startStepTime,
          ok: true,
          at: new Date(),
        });
      } catch (err) {
        job.trace.push({ step: 'write_script', tool: 'llm', ms: Date.now() - startStepTime, ok: false, at: new Date() });
        return { status: 'FAILED', job, stepsExecuted, lastAction: 'write_script', message: err.message };
      }
      continue;
    }

    // TOOL: verify_claims
    if (decision.tool === 'verify_claims') {
      job.trace.push({
        step: 'verify_claims',
        tool: 'llm',
        ms: Date.now() - startStepTime,
        ok: true,
        at: new Date(),
      });
      continue;
    }

    // TOOL: make_storyboard (PAID TOOL -> Enforce ANGLE_APPROVAL gate)
    if (decision.tool === 'make_storyboard') {
      if (!isGateApproved(job, 'ANGLE_APPROVAL')) {
        job.status = JOB_STATUSES.ANGLE_APPROVAL;
        job.trace.push({
          step: 'make_storyboard_blocked',
          tool: 'agent:policy',
          ms: Date.now() - startStepTime,
          ok: false,
          at: new Date(),
        });
        return {
          status: 'WAITING_APPROVAL',
          job,
          stepsExecuted,
          lastAction: 'make_storyboard',
          message: 'Visual storyboard generation requires ANGLE_APPROVAL approval first.',
        };
      }

      try {
        const scenes = Array.isArray(job.script) ? job.script : job.script?.scenes || [];
        const result = await storyboardGen(scenes);
        job.storyboard = result.storyboard;
        job.costEstimate = (job.costEstimate || 0) + (result.cost || 0);
        job.status = JOB_STATUSES.STORYBOARD_APPROVAL;
        job.trace.push({
          step: 'make_storyboard',
          tool: 'flux',
          ms: Date.now() - startStepTime,
          ok: true,
          at: new Date(),
        });
      } catch (err) {
        job.trace.push({ step: 'make_storyboard', tool: 'flux', ms: Date.now() - startStepTime, ok: false, at: new Date() });
        return { status: 'FAILED', job, stepsExecuted, lastAction: 'make_storyboard', message: err.message };
      }
      continue;
    }

    // TOOL: synthesize_voice (PAID TOOL -> Enforce STORYBOARD_APPROVAL gate)
    if (decision.tool === 'synthesize_voice') {
      if (!isGateApproved(job, 'STORYBOARD_APPROVAL')) {
        job.status = JOB_STATUSES.STORYBOARD_APPROVAL;
        job.trace.push({
          step: 'synthesize_voice_blocked',
          tool: 'agent:policy',
          ms: Date.now() - startStepTime,
          ok: false,
          at: new Date(),
        });
        return {
          status: 'WAITING_APPROVAL',
          job,
          stepsExecuted,
          lastAction: 'synthesize_voice',
          message: 'Voice synthesis requires STORYBOARD_APPROVAL approval first.',
        };
      }

      try {
        const scenes = job.storyboard || [];
        const voiceTracks = await voiceGen(scenes);
        job.audio = voiceTracks;
        job.audioUrl = voiceTracks[0]?.audioUrl || null;
        job.trace.push({
          step: 'synthesize_voice',
          tool: 'elevenlabs',
          ms: Date.now() - startStepTime,
          ok: true,
          at: new Date(),
        });
      } catch (err) {
        job.trace.push({ step: 'synthesize_voice', tool: 'elevenlabs', ms: Date.now() - startStepTime, ok: false, at: new Date() });
        return { status: 'FAILED', job, stepsExecuted, lastAction: 'synthesize_voice', message: err.message };
      }
      continue;
    }

    // TOOL: render_video (PAID TOOL -> Enforce STORYBOARD_APPROVAL gate)
    if (decision.tool === 'render_video') {
      if (!isGateApproved(job, 'STORYBOARD_APPROVAL')) {
        job.status = JOB_STATUSES.STORYBOARD_APPROVAL;
        job.trace.push({
          step: 'render_video_blocked',
          tool: 'agent:policy',
          ms: Date.now() - startStepTime,
          ok: false,
          at: new Date(),
        });
        return {
          status: 'WAITING_APPROVAL',
          job,
          stepsExecuted,
          lastAction: 'render_video',
          message: 'Video rendering requires STORYBOARD_APPROVAL approval first.',
        };
      }

      try {
        job.status = JOB_STATUSES.RENDER;
        const renderResult = await renderer(job, { voiceTracks: job.audio || [] });
        job.videoUrl = renderResult.videoUrl;
        job.status = JOB_STATUSES.FINAL_APPROVAL;
        job.trace.push({
          step: 'render_video',
          tool: 'creatomate',
          ms: Date.now() - startStepTime,
          ok: true,
          at: new Date(),
        });
      } catch (err) {
        job.trace.push({ step: 'render_video', tool: 'creatomate', ms: Date.now() - startStepTime, ok: false, at: new Date() });
        return { status: 'FAILED', job, stepsExecuted, lastAction: 'render_video', message: err.message };
      }
      continue;
    }

    // TOOL: deliver (Enforce FINAL_APPROVAL gate)
    if (decision.tool === 'deliver') {
      if (!isGateApproved(job, 'FINAL_APPROVAL')) {
        job.status = JOB_STATUSES.FINAL_APPROVAL;
        job.trace.push({
          step: 'deliver_blocked',
          tool: 'agent:policy',
          ms: Date.now() - startStepTime,
          ok: false,
          at: new Date(),
        });
        return {
          status: 'WAITING_APPROVAL',
          job,
          stepsExecuted,
          lastAction: 'deliver',
          message: 'Final video delivery requires FINAL_APPROVAL approval first.',
        };
      }

      job.status = JOB_STATUSES.DELIVERED;
      job.trace.push({
        step: 'deliver',
        tool: 'agent',
        ms: Date.now() - startStepTime,
        ok: true,
        at: new Date(),
      });

      return {
        status: 'COMPLETED',
        job,
        stepsExecuted,
        lastAction: 'deliver',
        message: `Video ready and delivered: ${job.videoUrl || 'Complete'}`,
      };
    }
  }

  return {
    status: 'MAX_STEPS_REACHED',
    job,
    stepsExecuted,
    lastAction,
    message: `Agent reached step limit of ${maxSteps}.`,
  };
}
