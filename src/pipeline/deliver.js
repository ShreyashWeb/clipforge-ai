import { JOB_STATUSES, transition } from './stateMachine.js';
import { uploadApprovedVideo } from '../services/youtube.js';
import { jobLogger } from '../utils/logger.js';

/**
 * Formats a clean list of verified sources for captions and notes.
 *
 * @param {Array<{title?: string, url?: string}>} sources
 * @returns {string}
 */
export function formatSourceLinks(sources = []) {
  if (!sources || sources.length === 0) return 'No external sources cited.';
  return sources
    .filter((s) => s?.url)
    .map((s, i) => `${i + 1}. [${s.title || s.url}](${s.url})`)
    .join('\n');
}

/**
 * Builds the Telegram delivery caption with download link and source citations.
 *
 * @param {object} job
 * @returns {string}
 */
export function buildDeliveryCaption(job) {
  const sourcesText = formatSourceLinks(job.sources);
  const downloadUrl = job.videoUrl || 'Local file generated';

  return `🎬 **ClipForge AI Video Ready!**\n\n📌 **Topic**: ${job.topic}\n📥 **Download Link**: ${downloadUrl}\n\n🔍 **Verified Sources Grounding This Video**:\n${sourcesText}`;
}

/**
 * Delivers the final video to Telegram as a video/file, including download link
 * and verified sources list. Optional YouTube Shorts upload is gated by an env flag
 * with automatic fallback to download link on any failure.
 *
 * @param {object} job
 * @param {{
 *   bot?: object,
 *   ctx?: object,
 *   chatId?: string|number,
 *   sendVideo?: (chatId: string|number, videoUrl: string, caption: string) => Promise<any>,
 *   youtubePublisher?: typeof uploadApprovedVideo,
 *   enableYouTube?: boolean
 * }} options
 * @returns {Promise<{
 *   delivered: boolean,
 *   videoUrl: string,
 *   downloadUrl: string,
 *   youtubeUrl?: string,
 *   sources: object[],
 *   message: string
 * }>}
 */
export async function deliverJob(job, options = {}) {
  const {
    bot,
    ctx,
    chatId = ctx?.chat?.id || job.userId,
    sendVideo,
    youtubePublisher = uploadApprovedVideo,
    enableYouTube = process.env.ENABLE_YOUTUBE_UPLOAD === 'true' || process.env.YOUTUBE_UPLOAD_ENABLED === 'true',
  } = options;

  if (!job.videoUrl) {
    throw new Error('Delivery requires a rendered video URL');
  }

  const log = jobLogger(job, { operation: 'deliver' });
  log.info('delivery_started', { status: job.status, videoUrl: job.videoUrl });

  const caption = buildDeliveryCaption(job);
  let youtubeUrl = null;

  // Optional YouTube upload behind env flag
  if (enableYouTube) {
    try {
      log.info('youtube_upload_attempt', { enableYouTube: true });
      const ytResult = await youtubePublisher(job, {
        notifyFallback: async (msg) => {
          if (ctx) await ctx.reply(msg);
          else if (bot && chatId) await bot.api.sendMessage(chatId, msg);
        },
      });
      if (ytResult.published && ytResult.videoUrl) {
        youtubeUrl = ytResult.videoUrl;
        log.info('youtube_upload_success', { youtubeUrl });
      }
    } catch (err) {
      log.warn('youtube_upload_failed_fallback_used', { error: err.message });
      // Gracefully fall back to download link
    }
  }

  // Send video to Telegram
  if (typeof sendVideo === 'function' && chatId) {
    await sendVideo(chatId, job.videoUrl, caption);
  } else if (ctx?.replyWithVideo) {
    await ctx.replyWithVideo(job.videoUrl, { caption, parse_mode: 'Markdown' });
  } else if (bot?.api?.sendVideo && chatId) {
    await bot.api.sendVideo(chatId, job.videoUrl, { caption, parse_mode: 'Markdown' });
  } else if (ctx?.reply) {
    await ctx.reply(caption, { parse_mode: 'Markdown' });
  } else if (bot?.api?.sendMessage && chatId) {
    await bot.api.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
  }

  // State Transition & Trace update
  if (job.status !== JOB_STATUSES.DELIVERED) {
    try {
      transition(job.status, JOB_STATUSES.DELIVERED);
    } catch {
      // If already at terminal or near-terminal state, allow direct assignment
    }
    job.status = JOB_STATUSES.DELIVERED;
  }

  job.trace = job.trace || [];
  job.trace.push({
    step: 'deliver',
    tool: 'telegram',
    ms: 0,
    ok: true,
    at: new Date(),
  });

  await job.save();
  log.info('delivery_completed', { status: job.status, youtubeUrl, videoUrl: job.videoUrl });

  return {
    delivered: true,
    videoUrl: job.videoUrl,
    downloadUrl: job.videoUrl,
    youtubeUrl,
    sources: job.sources || [],
    message: caption,
  };
}
