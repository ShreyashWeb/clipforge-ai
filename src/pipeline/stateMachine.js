export const JOB_STATUSES = Object.freeze({
  INTERVIEW: 'INTERVIEW',
  ANGLE_APPROVAL: 'ANGLE_APPROVAL',
  SCRIPT: 'SCRIPT',
  STORYBOARD_APPROVAL: 'STORYBOARD_APPROVAL',
  RENDER: 'RENDER',
  FINAL_APPROVAL: 'FINAL_APPROVAL',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
});

const allowedTransitions = Object.freeze({
  INTERVIEW: [JOB_STATUSES.ANGLE_APPROVAL, JOB_STATUSES.FAILED],
  ANGLE_APPROVAL: [JOB_STATUSES.SCRIPT, JOB_STATUSES.REJECTED, JOB_STATUSES.FAILED],
  SCRIPT: [JOB_STATUSES.STORYBOARD_APPROVAL, JOB_STATUSES.FAILED],
  STORYBOARD_APPROVAL: [JOB_STATUSES.RENDER, JOB_STATUSES.REJECTED, JOB_STATUSES.FAILED],
  RENDER: [JOB_STATUSES.FINAL_APPROVAL, JOB_STATUSES.FAILED],
  FINAL_APPROVAL: [JOB_STATUSES.PUBLISHED, JOB_STATUSES.REJECTED, JOB_STATUSES.FAILED],
  PUBLISHED: [],
  REJECTED: [],
  FAILED: [],
});

/**
 * Returns whether a job can move from one status to another.
 *
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
export function canTransition(currentStatus, nextStatus) {
  return allowedTransitions[currentStatus]?.includes(nextStatus) ?? false;
}

/**
 * Validates and returns the next job status.
 *
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {string}
 * @throws {Error} when the transition is not allowed
 */
export function transition(currentStatus, nextStatus) {
  if (!canTransition(currentStatus, nextStatus)) {
    throw new Error(`Invalid job transition: ${currentStatus} -> ${nextStatus}`);
  }

  return nextStatus;
}

export const ALLOWED_TRANSITIONS = allowedTransitions;
