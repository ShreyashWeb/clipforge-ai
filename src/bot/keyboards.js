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

/**
 * Builds storyboard review controls.
 *
 * @param {string} jobId
 * @returns {InlineKeyboard}
 */
export function storyboardKeyboard(jobId, scenes = []) {
  const keyboard = new InlineKeyboard().text('Approve storyboard', `job:${jobId}:approve`);
  if (scenes.length) {
    keyboard.row();
    scenes.forEach((scene) => {
      keyboard.text(`Regenerate ${scene.sceneNo}`, `job:${jobId}:regen:${scene.sceneNo}`);
    });
  }
  return keyboard.row().text('Edit storyboard', `job:${jobId}:edit`);
}
