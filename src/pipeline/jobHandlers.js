import { JOB_STATUSES, transition } from './stateMachine.js';

const approvalNextStatus = {
  ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
  STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
  FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
};

/**
 * Records an approval and advances a job to its next pipeline state.
 *
 * @param {object} job
 * @param {'approved'|'rejected'} decision
 * @returns {Promise<object>}
 */
export async function handleApproval(job, decision) {
  const nextStatus =
    decision === 'approved' ? approvalNextStatus[job.status] : JOB_STATUSES.REJECTED;
  if (!nextStatus) {
    throw new Error(`Job is not awaiting approval: ${job.status}`);
  }

  transition(job.status, nextStatus);
  job.approvals.push({ gate: job.status, decision, at: new Date() });
  job.status = nextStatus;
  await job.save();
  return job;
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
