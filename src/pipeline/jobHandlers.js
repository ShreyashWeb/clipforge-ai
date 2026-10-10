import { JOB_STATUSES } from './stateMachine.js';
import { applyJobDecision } from '../services/jobs.js';

/**
 * Records an approval and advances a job to its next pipeline state.
 * Delegates to the unified applyJobDecision service function.
 *
 * @param {object} job
 * @param {'approved'|'rejected'|'approve'|'reject'} decision
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function handleApproval(job, decision, options = {}) {
  return applyJobDecision(job, {
    gate: job.status,
    decision,
    ...options,
  });
}

/**
 * Resumes a job after an interview answer is received.
 *
 * @param {object} job
 * @param {string} answer
 * @returns {Promise<object>}
 */
export async function handleInterviewAnswer(job, answer) {
  if (job.status !== JOB_STATUSES.INTERVIEW) {
    throw new Error(`Job is not in interview: ${job.status}`);
  }
  job.interviewAnswers = {
    ...(job.interviewAnswers || {}),
    latest: answer,
  };
  job.topic = job.topic === 'Untitled video' ? answer : job.topic;
  await job.save();
  return job;
}
