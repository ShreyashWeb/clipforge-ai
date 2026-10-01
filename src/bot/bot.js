import { Bot, webhookCallback } from 'grammy';
import { Job } from '../models/Job.js';
import { JOB_STATUSES, transition } from '../pipeline/stateMachine.js';
import { handleApproval } from '../pipeline/jobHandlers.js';
import { createInterviewPlan, defaultLlm, recordInterviewAnswer } from '../pipeline/interview.js';
import { generateScript } from '../pipeline/script.js';
import { researchTopic } from '../services/research.js';
import { explainGitHubChange, parseGitHubUrl, researchGitHub } from '../services/github.js';
import { generateSceneImage, generateStoryboardImages } from '../services/imageGen.js';
import { uploadApprovedVideo } from '../services/youtube.js';
import { approvalKeyboard, storyboardKeyboard } from './keyboards.js';
import { transcribeAudio as defaultTranscription } from './transcription.js';

const callbackPattern = /^job:([^:]+):(approve|reject|edit)$/;

async function sendStoryboard(ctx, job) {
  const media = job.storyboard.map((scene) => ({
    type: 'photo',
    media: scene.imageUrl,
    caption: `Scene ${scene.sceneNo}: ${scene.narration}`,
  }));
  await ctx.api.sendMediaGroup(ctx.chat.id, media);
  await ctx.reply('Review the storyboard. Approve it or regenerate an individual scene.', {
    reply_markup: storyboardKeyboard(String(job._id), job.storyboard),
  });
}

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
  githubResearch = researchGitHub,
  llm = defaultLlm,
  githubExplainer = explainGitHubChange,
  scriptGenerator = generateScript,
  storyboardGenerator = generateStoryboardImages,
  sceneImageGenerator = generateSceneImage,
  youtubePublisher = uploadApprovedVideo,
} = {}) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const topic = ctx.match?.trim() || 'Untitled video';
    const isGitHub = /^https:\/\/github\.com\//i.test(topic);
    if (isGitHub) parseGitHubUrl(topic);
    const job = await model.create({
      userId: String(ctx.from.id),
      topic,
      sourceType: isGitHub ? 'github' : 'topic',
    });
    const plan = await createInterviewPlan(job.topic, {
      research: isGitHub ? githubResearch : research,
      llm,
    });
    job.sources = plan.sources;
    if (isGitHub) {
      job.githubSummary = await githubExplainer(plan.sources, llm);
    }
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
      const previousStatus = job.status;
      await handleApproval(job, action === 'approve' ? 'approved' : 'rejected');
      let scriptNotice = '';
      if (action === 'approve' && previousStatus === JOB_STATUSES.ANGLE_APPROVAL) {
        const scriptResult = await scriptGenerator(job.topic, {
          sources: job.sources,
          angle: job.interviewAnswers?.answers?.uniqueAngle || job.selectedAngle || '',
          llm,
        });
        job.script = scriptResult;
        await job.save();
        transition(job.status, JOB_STATUSES.STORYBOARD_APPROVAL);
        job.status = JOB_STATUSES.STORYBOARD_APPROVAL;
        const generated = await storyboardGenerator(job.script.scenes);
        job.storyboard = generated.storyboard;
        job.costEstimate += generated.cost;
        await job.save();
        scriptNotice = scriptResult.unsupportedLines.length
          ? `\n\nSource review flags:\n${scriptResult.unsupportedLines
              .map((flag) => `Line ${flag.line}: ${flag.reason}`)
              .join('\n')}`
          : '\n\nSource review: all narration lines are supported.';
      }
      await ctx.answerCallbackQuery({ text: `Job ${action}d.` });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      if (action === 'approve' && previousStatus === JOB_STATUSES.ANGLE_APPROVAL) {
        await sendStoryboard(ctx, job);
        return;
      }
      if (action === 'approve' && previousStatus === JOB_STATUSES.FINAL_APPROVAL) {
        const publishResult = await youtubePublisher(job, {
          notifyFallback: (message) => ctx.reply(message),
        });
        if (publishResult.fallback) return;
        await ctx.reply(`Published to YouTube: ${publishResult.videoUrl}`);
        return;
      }
      await ctx.reply(`Job moved to ${job.status}. ${jobPrompt(job)}${scriptNotice}`);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: error.message.slice(0, 190) });
    }
  });

  bot.callbackQuery(/^job:([^:]+):regen:(\d+)$/, async (ctx) => {
    const [, jobId, sceneNumber] = ctx.match;
    const job = await findUserJob(model, ctx.from.id, jobId);
    if (!job || job.status !== JOB_STATUSES.STORYBOARD_APPROVAL) {
      await ctx.answerCallbackQuery({ text: 'Storyboard is not awaiting review.' });
      return;
    }

    const scene = job.storyboard.find((item) => String(item.sceneNo) === sceneNumber);
    if (!scene) {
      await ctx.answerCallbackQuery({ text: 'Scene not found.' });
      return;
    }
    try {
      const generated = await sceneImageGenerator(scene);
      scene.imageUrl = generated.url;
      job.costEstimate += generated.cost;
      await job.save();
      await ctx.answerCallbackQuery({ text: `Scene ${sceneNumber} regenerated.` });
      await sendStoryboard(ctx, job);
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
