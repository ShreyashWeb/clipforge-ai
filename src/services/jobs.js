import EventEmitter from 'events';
import { JOB_STATUSES, transition } from '../pipeline/stateMachine.js';
import { replayDemoJob } from '../pipeline/demoReplay.js';
import { jobLogger } from '../utils/logger.js';

export const jobEvents = new EventEmitter();
// Increase max listeners for concurrent SSE streams
jobEvents.setMaxListeners(100);

/**
 * Emits a trace event for a specific job across active SSE streams.
 *
 * @param {string} jobId
 * @param {object} traceEvent
 */
export function emitTraceEvent(jobId, traceEvent) {
  jobEvents.emit(`trace:${String(jobId)}`, traceEvent);
  jobEvents.emit('trace', { jobId: String(jobId), ...traceEvent });
}

/**
 * Subscribes to trace events for a specific job.
 *
 * @param {string} jobId
 * @param {(event: object) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function subscribeTraceEvents(jobId, listener) {
  const channel = `trace:${String(jobId)}`;
  jobEvents.on(channel, listener);
  return () => {
    jobEvents.off(channel, listener);
  };
}

const approvalStatuses = new Set([
  JOB_STATUSES.ANGLE_APPROVAL,
  JOB_STATUSES.STORYBOARD_APPROVAL,
  JOB_STATUSES.FINAL_APPROVAL,
]);

export function getRetryStatus(job) {
  const lastApproval = [...(job.approvals || [])].reverse().find(
    (approval) => approval.decision === 'approved' || approval.decision === 'approve',
  );

  if (!lastApproval) {
    return JOB_STATUSES.INTERVIEW;
  }

  const nextStatusByGate = {
    ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
    STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
    FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
  };

  return nextStatusByGate[lastApproval.gate] || JOB_STATUSES.INTERVIEW;
}

/**
 * Core unified service function to validate gates, record decisions,
 * and resume the agent or pipeline step.
 * Used by both Telegram buttons and the REST API / dashboard.
 *
 * @param {object} job
 * @param {{
 *   gate: string,
 *   decision: 'approved' | 'rejected' | 'approve' | 'reject',
 *   triggerNextStep?: (job: object) => Promise<any>,
 *   agentLoop?: (job: object) => Promise<any>
 * }} options
 * @returns {Promise<object>}
 */
export async function applyJobDecision(job, { gate, decision, triggerNextStep, agentLoop } = {}) {
  const normalizedDecision = decision === 'approved' || decision === 'approve' ? 'approved' : 'rejected';

  if (!approvalStatuses.has(job.status) || gate !== job.status) {
    const error = new Error(`Gate ${gate} does not match the current job state`);
    error.code = 'INVALID_GATE';
    error.status = 400;
    throw error;
  }

  const nextStatus =
    normalizedDecision === 'approved'
      ? {
          ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
          STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
          FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
        }[job.status]
      : JOB_STATUSES.REJECTED;

  transition(job.status, nextStatus);

  const log = jobLogger(job, { operation: 'approval', gate, decision: normalizedDecision });
  log.info('approval_started', { status: job.status });

  job.approvals = job.approvals || [];
  job.approvals.push({ gate, decision: normalizedDecision, at: new Date() });
  job.status = nextStatus;
  await job.save();

  const traceEntry = {
    step: `decision_${normalizedDecision}`,
    tool: 'human:decision',
    ms: 0,
    ok: normalizedDecision === 'approved',
    at: new Date(),
  };
  job.trace = job.trace || [];
  job.trace.push(traceEntry);
  emitTraceEvent(job._id, traceEntry);

  if (normalizedDecision === 'approved') {
    if (typeof triggerNextStep === 'function') {
      await triggerNextStep(job);
    } else if (typeof agentLoop === 'function') {
      await agentLoop(job);
    }
  }

  log.info('approval_completed', { status: job.status });
  return job;
}

/**
 * Unified retry service function.
 * Resumes failed jobs from the last approved gate.
 *
 * @param {object} job
 * @param {{
 *   triggerNextStep?: (job: object) => Promise<any>,
 *   agentLoop?: (job: object) => Promise<any>
 * }} options
 * @returns {Promise<object>}
 */
export async function retryJob(job, { triggerNextStep, agentLoop } = {}) {
  if (job.status !== JOB_STATUSES.FAILED) {
    const error = new Error('Only failed jobs can be retried');
    error.code = 'INVALID_RETRY';
    error.status = 400;
    throw error;
  }

  const log = jobLogger(job, { operation: 'retry' });
  log.info('job_retry_started', { status: job.status });

  if (process.env.DEMO_MODE === 'true') {
    const replayed = await replayDemoJob(job);
    log.info('job_retry_completed', { status: replayed.status, source: 'demo-cache' });
    return replayed;
  }

  const retryStatus = getRetryStatus(job);
  job.status = retryStatus;
  await job.save();

  const traceEntry = {
    step: 'job_retry',
    tool: 'pipeline:retry',
    ms: 0,
    ok: true,
    at: new Date(),
  };
  job.trace = job.trace || [];
  job.trace.push(traceEntry);
  emitTraceEvent(job._id, traceEntry);

  if (typeof triggerNextStep === 'function') {
    await triggerNextStep(job);
  } else if (typeof agentLoop === 'function') {
    await agentLoop(job);
  }

  log.info('job_retry_completed', { status: job.status });
  return job;
}
