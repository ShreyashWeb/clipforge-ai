import { Bot, webhookCallback } from 'grammy';
import { Job } from '../models/Job.js';
import { JOB_STATUSES, transition } from '../pipeline/stateMachine.js';
import { handleApproval } from '../pipeline/jobHandlers.js';
import { createInterviewPlan, defaultLlm, recordInterviewAnswer } from '../pipeline/interview.js';
import { generateScript } from '../pipeline/script.js';
import { researchTopic } from '../services/research.js';
import { explainGitHubChange, parseGitHubUrl, researchGitHub } from '../services/github.js';
import { replayDemoJob } from '../pipeline/demoReplay.js';
import { generateSceneImage, generateStoryboardImages } from '../services/imageGen.js';
import { uploadApprovedVideo } from '../services/youtube.js';
import { deliverJob } from '../pipeline/deliver.js';
import { approvalKeyboard, storyboardKeyboard } from './keyboards.js';
import { transcribeAudio as defaultTranscription } from './transcription.js';
import { runAgentLoop as defaultAgentLoop } from '../agent/agent.js';

const callbackPattern = /^job:([^:]+):(approve|reject|edit)$/;

async function sendStoryboard(ctx, job) {
  if (!job.storyboard?.length) return;
  const media = job.storyboard.map((scene) => ({
    type: 'photo',
    media: scene.imageUrl,
    caption: `Scene ${scene.sceneNo || scene.scene}: ${scene.narration}`,
  }));
  await ctx.api.sendMediaGroup(ctx.chat.id, media);
  await ctx.reply('Review the storyboard scenes above. Approve to start video rendering or regenerate individual scenes:', {
    reply_markup: storyboardKeyboard(String(job._id), job.storyboard),
  });
}

function jobPrompt(job) {
  const prompts = {
    [JOB_STATUSES.INTERVIEW]: 'Tell me the topic, audience, and tone for this video.',
    [JOB_STATUSES.ANGLE_APPROVAL]: 'Review and choose an angle for this video:',
    [JOB_STATUSES.STORYBOARD_APPROVAL]: 'Review the storyboard visuals and choose an action:',
    [JOB_STATUSES.FINAL_APPROVAL]: 'The video render is ready! Approve it to publish or reject it.',
    [JOB_STATUSES.DELIVERED]: `Video completed! Watch it here: ${job.videoUrl}`,
  };
  return prompts[job.status] || `Current job state: ${job.status}`;
}

async function findUserJob(model, userId, jobId) {
  return model.findOne({ _id: jobId, userId: String(userId) });
}

/**
 * Creates the grammY Telegram bot with multimodal input handling (text, voice, photo)
 * and thin agent-delegated state routing.
 *
 * @param {{
 *   token?: string,
 *   model?: typeof Job,
 *   transcription?: (audio: Buffer) => Promise<string>,
 *   agentLoop?: typeof defaultAgentLoop,
 *   research?: typeof researchTopic,
 *   githubResearch?: typeof researchGitHub,
 *   llm?: typeof defaultLlm,
 *   githubExplainer?: typeof explainGitHubChange,
 *   scriptGenerator?: typeof generateScript,
 *   storyboardGenerator?: typeof generateStoryboardImages,
 *   sceneImageGenerator?: typeof generateSceneImage,
 *   youtubePublisher?: typeof uploadApprovedVideo,
 *   client?: object,
 *   botInfo?: object
 * }} options
 * @returns {Bot}
 */
export function createBot({
  token = process.env.TELEGRAM_BOT_TOKEN,
  model = Job,
  transcription = defaultTranscription,
  agentLoop = defaultAgentLoop,
  research = researchTopic,
  githubResearch = researchGitHub,
  llm = defaultLlm,
  githubExplainer = explainGitHubChange,
  scriptGenerator = generateScript,
  storyboardGenerator = generateStoryboardImages,
  sceneImageGenerator = generateSceneImage,
  youtubePublisher = uploadApprovedVideo,
  client,
  botInfo,
} = {}) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const bot = new Bot(token, { client, botInfo });

  // COMMAND: /start <topic or github url>
  bot.command('start', async (ctx) => {
    const topic = ctx.match?.trim() || 'Untitled video';
    const isGitHub = /^https:\/\/github\.com\//i.test(topic);
    if (isGitHub) parseGitHubUrl(topic);

    const job = await model.create({
      userId: String(ctx.from.id),
      topic,
      sourceType: isGitHub ? 'github' : 'topic',
      inputs: [{ type: 'text', ref: topic }],
      status: JOB_STATUSES.INTERVIEW,
    });

    if (process.env.DEMO_MODE === 'true') {
      await replayDemoJob(job);
      await ctx.reply(`Demo replay complete: ${job.topic}\n\n${job.videoUrl}`);
      return;
    }

    await ctx.reply(`⚡ ClipForge AI job created for: "${job.topic}"\n\n🔍 Researching sources and planning creative interview...`);

    try {
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

      await ctx.reply(
        `📋 Question 1: ${plan.questions[0].question}\n\n(Reply with text or a voice note!)`,
      );
    } catch (err) {
      await ctx.reply(`Could not start interview plan: ${err.message}`);
    }
  });

  // MESSAGE: Text input handler
  bot.on('message:text', async (ctx) => {
    const job = await model.findOne({
      userId: String(ctx.from.id),
      status: { $nin: [JOB_STATUSES.PUBLISHED, JOB_STATUSES.DELIVERED, JOB_STATUSES.REJECTED] },
    }).sort({ createdAt: -1 });

    if (!job) {
      await ctx.reply('Send /start <topic> to start creating a new video.');
      return;
    }

    job.inputs.push({ type: 'text', ref: ctx.message.text });
    await job.save();

    if (job.status === JOB_STATUSES.INTERVIEW) {
      const progress = recordInterviewAnswer(job, ctx.message.text);
      await job.save();

      if (progress.complete) {
        job.status = JOB_STATUSES.ANGLE_APPROVAL;
        await job.save();
        await ctx.reply(
          `✨ Creative interview complete!\n\n🪝 Hook Options:\n${job.hooks.map((hook, index) => `${index + 1}. "${hook}"`).join('\n')}\n\n📐 Unique Angles:\n${job.interviewAnswers.angles.map((angle, index) => `${index + 1}. ${angle}`).join('\n')}\n\nApprove angle to start scriptwriting & visual storyboard:`,
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

  // MESSAGE: Voice note input handler
  bot.on('message:voice', async (ctx) => {
    const job = await model.findOne({
      userId: String(ctx.from.id),
      status: { $nin: [JOB_STATUSES.PUBLISHED, JOB_STATUSES.DELIVERED, JOB_STATUSES.REJECTED] },
    }).sort({ createdAt: -1 });

    if (!job) {
      await ctx.reply('Send /start <topic> to start creating a new video.');
      return;
    }

    try {
      await ctx.reply('🎧 Transcribing your voice note via Gemini multimodal reasoning...');
      const file = await ctx.api.getFile(ctx.message.voice.file_id);
      const response = await fetch(file.getUrl(), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Telegram voice download failed: ${response.status}`);

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const transcript = await transcription(audioBuffer);

      job.inputs.push({ type: 'voice', ref: ctx.message.voice.file_id });
      await job.save();

      await ctx.reply(`🎙️ Transcribed: "${transcript}"`);

      // Forward transcribed text to the active interview/job pipeline
      if (job.status === JOB_STATUSES.INTERVIEW) {
        const progress = recordInterviewAnswer(job, transcript);
        await job.save();

        if (progress.complete) {
          job.status = JOB_STATUSES.ANGLE_APPROVAL;
          await job.save();
          await ctx.reply(
            `✨ Interview complete!\n\n🪝 Hooks:\n${job.hooks.map((h, i) => `${i + 1}. "${h}"`).join('\n')}\n\n📐 Angles:\n${job.interviewAnswers.angles.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
            { reply_markup: approvalKeyboard(String(job._id)) },
          );
        } else {
          await ctx.reply(progress.nextQuestion.question);
        }
      }
    } catch (err) {
      await ctx.reply(`Audio transcription error: ${err.message}`);
    }
  });

  // MESSAGE: Photo style / brand reference input handler
  bot.on('message:photo', async (ctx) => {
    const job = await model.findOne({
      userId: String(ctx.from.id),
      status: { $nin: [JOB_STATUSES.PUBLISHED, JOB_STATUSES.DELIVERED, JOB_STATUSES.REJECTED] },
    }).sort({ createdAt: -1 });

    if (!job) {
      await ctx.reply('Send /start <topic> to create a video job first.');
      return;
    }

    try {
      const highestResPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(highestResPhoto.file_id);
      const photoUrl = file.getUrl();

      job.inputs.push({ type: 'image', ref: photoUrl });
      await job.save();

      await ctx.reply('🖼️ Image reference saved! It will be used as a visual style and branding guide for scene generation.');
    } catch (err) {
      await ctx.reply(`Could not save photo reference: ${err.message}`);
    }
  });

  // CALLBACK QUERIES: Approvals (approve, reject, edit)
  bot.callbackQuery(callbackPattern, async (ctx) => {
    const [, jobId, action] = ctx.match;
    const job = await findUserJob(model, ctx.from.id, jobId);
    if (!job) {
      await ctx.answerCallbackQuery({ text: 'Job not found.' });
      return;
    }
    if (action === 'edit') {
      await ctx.answerCallbackQuery();
      await ctx.reply('Reply with your replacement text, direction, or style edits for this stage.');
      return;
    }

    try {
      const previousStatus = job.status;
      await handleApproval(job, action === 'approve' ? 'approved' : 'rejected');

      let scriptNotice = '';
      if (action === 'approve' && previousStatus === JOB_STATUSES.ANGLE_APPROVAL) {
        await ctx.reply('⏳ Drafting source-grounded script and generating Flux visual scenes...');
        const scriptResult = await scriptGenerator(job.topic, {
          sources: job.sources,
          angle: job.interviewAnswers?.answers?.uniqueAngle || job.selectedAngle || job.angle || '',
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
          ? `\n\n⚠️ Source review flags:\n${scriptResult.unsupportedLines
              .map((flag) => `Line ${flag.line}: ${flag.reason}`)
              .join('\n')}`
          : '\n\n✓ All narration lines verified against sources.';
      }

      await ctx.answerCallbackQuery({ text: `Job ${action}d.` });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      if (action === 'approve' && previousStatus === JOB_STATUSES.ANGLE_APPROVAL) {
        await sendStoryboard(ctx, job);
        return;
      }

      if (action === 'approve' && previousStatus === JOB_STATUSES.FINAL_APPROVAL) {
        await deliverJob(job, {
          ctx,
          youtubePublisher,
          enableYouTube: process.env.ENABLE_YOUTUBE_UPLOAD === 'true',
        });
        return;
      }

      await ctx.reply(`Job moved to ${job.status}. ${jobPrompt(job)}${scriptNotice}`);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: error.message.slice(0, 190) });
    }
  });

  // CALLBACK QUERIES: Regenerate individual storyboard scene image
  bot.callbackQuery(/^job:([^:]+):regen:(\d+)$/, async (ctx) => {
    const [, jobId, sceneNumber] = ctx.match;
    const job = await findUserJob(model, ctx.from.id, jobId);
    if (!job || job.status !== JOB_STATUSES.STORYBOARD_APPROVAL) {
      await ctx.answerCallbackQuery({ text: 'Storyboard is not awaiting review.' });
      return;
    }

    const scene = job.storyboard.find((item) => String(item.sceneNo || item.scene) === sceneNumber);
    if (!scene) {
      await ctx.answerCallbackQuery({ text: 'Scene not found.' });
      return;
    }
    try {
      await ctx.answerCallbackQuery({ text: `Regenerating scene ${sceneNumber}...` });
      const generated = await sceneImageGenerator(scene);
      scene.imageUrl = generated.url;
      job.costEstimate += generated.cost;
      await job.save();
      await sendStoryboard(ctx, job);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: error.message.slice(0, 190) });
    }
  });

  return bot;
}

/**
 * Starts Telegram in webhook or long-polling mode based on environment.
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
