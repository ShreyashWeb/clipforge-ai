import { Router } from 'express';
import { z } from 'zod';
import { Job } from '../models/Job.js';
import { JOB_STATUSES } from '../pipeline/stateMachine.js';
import { applyJobDecision, retryJob, subscribeTraceEvents } from '../services/jobs.js';

const idSchema = z.string().min(1);
const gateSchema = z.object({ gate: z.string().min(1) }).strict();
const statusSchema = z.enum(Object.values(JOB_STATUSES));

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function serializeJob(job) {
  return typeof job.toObject === 'function' ? job.toObject() : job;
}

/**
 * Creates the job and statistics API router.
 *
 * @param {{
 *   model?: typeof Job,
 *   triggerNextStep?: (job: object) => Promise<void>,
 *   agentLoop?: (job: object) => Promise<void>
 * }} options
 * @returns {import('express').Router}
 */
export function createJobsRouter({
  model = Job,
  triggerNextStep,
  agentLoop,
} = {}) {
  const router = Router();

  // GET /api/jobs - List user's jobs with optional status filter
  router.get('/jobs', async (request, response, next) => {
    try {
      const status = request.query.status ? statusSchema.parse(request.query.status) : undefined;
      const query = { userId: request.user.id, ...(status ? { status } : {}) };
      const jobs = await model.find(query).sort({ createdAt: -1 });
      return response.json({ jobs: jobs.map(serializeJob) });
    } catch (error) {
      if (error.name === 'ZodError') {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Invalid status query parameter');
      }
      return next(error);
    }
  });

  // GET /api/jobs/:id/stream - Server-Sent Events (SSE) of trace events
  router.get('/jobs/:id/stream', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const job = await model.findById(id);

      if (!job || String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      if (typeof response.flushHeaders === 'function') {
        response.flushHeaders();
      }

      // Stream existing trace events
      if (Array.isArray(job.trace)) {
        for (const traceEntry of job.trace) {
          response.write(`data: ${JSON.stringify(traceEntry)}\n\n`);
        }
      }

      // Subscribe to real-time trace events
      const unsubscribe = subscribeTraceEvents(String(job._id || id), (event) => {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      request.on('close', () => {
        unsubscribe();
        response.end();
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Invalid job ID format');
      }
      return next(error);
    }
  });

  // GET /api/jobs/:id - Get detailed job state by ID
  router.get('/jobs/:id', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const job = await model.findById(id);
      if (!job || String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }

      return response.json({ job: serializeJob(job) });
    } catch (error) {
      if (error.name === 'ZodError') {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Invalid job ID format');
      }
      return next(error);
    }
  });

  // Helper for approval/rejection endpoints
  async function handleDecisionRoute(request, response, next, decision) {
    try {
      const id = idSchema.parse(request.params.id);
      const { gate } = gateSchema.parse(request.body);
      const job = await model.findById(id);

      if (!job || String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }

      const updatedJob = await applyJobDecision(job, {
        gate,
        decision,
        triggerNextStep,
        agentLoop,
      });

      return response.json({ job: serializeJob(updatedJob) });
    } catch (error) {
      if (error.name === 'ZodError') {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Invalid request body or gate parameter');
      }
      if (error.code === 'INVALID_GATE') {
        return errorResponse(response, 400, 'INVALID_GATE', error.message);
      }
      return next(error);
    }
  }

  // POST /api/jobs/:id/approve - Validate gate and approve
  router.post('/jobs/:id/approve', (request, response, next) =>
    handleDecisionRoute(request, response, next, 'approved'),
  );

  // POST /api/jobs/:id/reject - Validate gate and reject
  router.post('/jobs/:id/reject', (request, response, next) =>
    handleDecisionRoute(request, response, next, 'rejected'),
  );

  // POST /api/jobs/:id/retry - Retry failed jobs from the last approved gate
  router.post('/jobs/:id/retry', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const job = await model.findById(id);

      if (!job || String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }

      const retriedJob = await retryJob(job, {
        triggerNextStep,
        agentLoop,
      });

      return response.json({ job: serializeJob(retriedJob) });
    } catch (error) {
      if (error.name === 'ZodError') {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Invalid job ID format');
      }
      if (error.code === 'INVALID_RETRY') {
        return errorResponse(response, 400, 'INVALID_RETRY', error.message);
      }
      return next(error);
    }
  });

  // POST /api/hooks - Real-time AI hook generation for any given topic
  router.post('/hooks', async (request, response, next) => {
    try {
      const topic = String(request.body?.topic || '').trim();
      if (!topic) {
        return errorResponse(response, 400, 'VALIDATION_ERROR', 'Topic is required');
      }
      const tone = request.body?.tone || 'Fast-Paced';
      const audience = request.body?.audience || 'General Tech';

      const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
      const endpoint = process.env.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
      const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

      if (apiKey && endpoint) {
        try {
          const prompt = `Generate exactly 3 distinct, high-retention video opening hooks for a short video about: "${topic}".
Target Audience: ${audience}
Narrative Tone: ${tone}

Rules:
- Hooks must directly mention and be deeply relevant to "${topic}".
- Never use generic boilerplate or introductory fluff like "In this video" or "Welcome back".
- Return ONLY valid JSON with this exact format:
{"hooks":["...","...","..."]}`;

          const llmRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              temperature: 0.7,
              response_format: { type: 'json_object' },
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (llmRes.ok) {
            const data = await llmRes.json();
            const rawContent = data.choices?.[0]?.message?.content || data.output_text;
            const parsed = JSON.parse(rawContent.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());
            if (Array.isArray(parsed.hooks) && parsed.hooks.length >= 3) {
              return response.json({ hooks: parsed.hooks.slice(0, 3), topic });
            }
          }
        } catch (llmErr) {
          // Fall back to algorithmic response if LLM encounters transient error
        }
      }

      return response.json({
        hooks: [
          `The untold truth about ${topic} that most people find out way too late.`,
          `Why everything you have been told about ${topic} is about to change forever.`,
          `The step-by-step roadmap to mastering ${topic} without wasting months of effort.`,
        ],
        topic,
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/stats - Aggregate metrics
  router.get('/stats', async (request, response, next) => {
    try {
      const jobs = await model.find({ userId: request.user.id });
      const publishedJobs = jobs.filter((job) => job.status === JOB_STATUSES.PUBLISHED);
      const durations = publishedJobs
        .map((job) => new Date(job.updatedAt) - new Date(job.createdAt))
        .filter((duration) => Number.isFinite(duration) && duration >= 0);
      const totalEstimatedCost = jobs.reduce(
        (total, job) => total + (Number(job.costEstimate) || 0),
        0,
      );

      return response.json({
        jobsCount: jobs.length,
        averageTimePerVideo: durations.length
          ? durations.reduce((total, duration) => total + duration, 0) / durations.length
          : 0,
        estimatedCostSaved: totalEstimatedCost,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
