/**
 * Transcribes an audio buffer through a configured provider.
 *
 * @param {Buffer} _audio
 * @returns {Promise<string>}
 */
export async function transcribeAudio(_audio) {
  throw new Error('No transcription service configured');
}
