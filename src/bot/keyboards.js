import { InlineKeyboard } from 'grammy';

/**
 * Builds the approval controls for a job.
 *
 * @param {string} jobId
 * @returns {InlineKeyboard}
 */
export function approvalKeyboard(jobId) {
  return new InlineKeyboard()
    .text('Approve', `job:${jobId}:approve`)
    .text('Reject', `job:${jobId}:reject`)
    .text('Edit', `job:${jobId}:edit`);
}
