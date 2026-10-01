import { Bot, webhookCallback } from 'grammy';
import { Job } from '../models/Job.js';
import { JOB_STATUSES } from '../pipeline/stateMachine.js';
import { handleApproval } from '../pipeline/jobHandlers.js';
import { createInterviewPlan, recordInterviewAnswer } from '../pipeline/interview.js';
import { researchTopic } from '../services/research.js';
import { approvalKeyboard } from './keyboards.js';
import { transcribeAudio as defaultTranscription } from './transcription.js';

const callbackPattern = /^job:([^:]+):(approve|reject|edit)$/;

function jobPrompt(job) {
  const prompts = {
    [JOB_STATUSES.INTERVIEW]: 'Tell me the topic, audience, and tone for this video.',
    [JOB_STATUSES.ANGLE_APPROVAL]: 'Choose an angle for this video:',
    [JOB_STATUSES.STORYBOARD_APPROVAL]: 'Review the storyboard and choose an action:',
    [JOB_STATUSES.FINAL_APPROVAL]: 'The render is ready. Approve it to publish or reject it.',
  };
  return prompts[job.status] || `Current job state: ${job.status}`;
}

async function findUserJob(model, userId, jobId) {
  return model.findOne({ _id: jobId, userId: String(userId) });
}

/**
 * Creates the Telegram bot and registers thin state-routed handlers.
 *
 * @param {{ token?: string, model?: typeof Job, transcription?: (audio: Buffer) => Promise<string> }} options
 * @returns {Bot}
 */
export function createBot({
  token = process.env.TELEGRAM_BOT_TOKEN,
  model = Job,
  transcription = defaultTranscription,
  research = researchTopic,
  llm,
} = {}) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const topic = ctx.match?.trim() || 'Untitled video';
    const job = await model.create({
      userId: String(ctx.from.id),
      topic,
      sourceType: 'topic',
    });
    const plan = await createInterviewPlan(job.topic, { research, llm });
    job.sources = plan.sources;
    job.hooks = plan.hooks;
    job.interviewAnswers = {
      questions: plan.questions,
      angles: plan.angles,
      answers: {},
    };
    await job.save();
    await ctx.reply(`New ClipForge job created: ${job.topic}\n\n${plan.questions[0].question}`);
  });

  bot.on('message:text', async (ctx) => {
    const job = await model.findOne({
      userId: String(ctx.from.id),
      status: { $nin: [JOB_STATUSES.PUBLISHED, JOB_STATUSES.REJECTED] },
    }).sort({ createdAt: -1 });
    if (!job) {
      await ctx.reply('Send /start to create a video job.');
      return;
    }

    if (job.status === JOB_STATUSES.INTERVIEW) {
      const progress = recordInterviewAnswer(job, ctx.message.text);
      await job.save();
      if (progress.complete) {
        job.status = JOB_STATUSES.ANGLE_APPROVAL;
        await job.save();
        await ctx.reply(
          `Interview complete.\n\nHooks:\n${job.hooks.map((hook, index) => `${index + 1}. ${hook}`).join('\n')}\n\nAngles:\n${job.interviewAnswers.angles.map((angle, index) => `${index + 1}. ${angle}`).join('\n')}`,
          { reply_markup: approvalKeyboard(String(job._id)) },
        );
      } else {
        await ctx.reply(progress.nextQuestion.question);
      }
      return;
    }
    await ctx.reply(jobPrompt(job), {
      reply_markup: approvalKeyboard(String(job._id)),
    });
  });

  bot.on('message:voice', async (ctx) => {
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const response = await fetch(file.getUrl(), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Telegram voice download failed: ${response.status}`);
    const transcript = await transcription(Buffer.from(await response.arrayBuffer()));
    await ctx.reply(`Transcribed: ${transcript}`);
    await bot.handleUpdate({
      update_id: ctx.update.update_id,
      message: { ...ctx.message, text: transcript, voice: undefined },
    });
  });

  bot.callbackQuery(callbackPattern, async (ctx) => {
    const [, jobId, action] = ctx.match;
    const job = await findUserJob(model, ctx.from.id, jobId);
    if (!job) {
      await ctx.answerCallbackQuery({ text: 'Job not found.' });
      return;
    }
    if (action === 'edit') {
      await ctx.answerCallbackQuery();
      await ctx.reply('Reply with the replacement text for this stage.');
      return;
    }

    try {
      await handleApproval(job, action === 'approve' ? 'approved' : 'rejected');
      await ctx.answerCallbackQuery({ text: `Job ${action}d.` });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(`Job moved to ${job.status}. ${jobPrompt(job)}`);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: error.message.slice(0, 190) });
    }
  });

  return bot;
}

/**
 * Starts Telegram in webhook or long-polling mode.
 *
 * @param {Bot} bot
 * @returns {Promise<void>}
 */
export async function startBot(bot) {
  if (process.env.TELEGRAM_MODE === 'webhook') {
    if (!process.env.TELEGRAM_WEBHOOK_URL) {
      throw new Error('TELEGRAM_WEBHOOK_URL is required in webhook mode');
    }
    await bot.api.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
    return;
  }
  await bot.start();
}

/**
 * Returns an Express handler for Telegram webhook delivery.
 *
 * @param {Bot} bot
 * @returns {import('express').RequestHandler}
 */
export function telegramWebhookHandler(bot) {
  return webhookCallback(bot, 'express');
}
