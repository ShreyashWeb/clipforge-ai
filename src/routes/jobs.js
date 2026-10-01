import { Router } from 'express';
import { z } from 'zod';
import { Job } from '../models/Job.js';
import { JOB_STATUSES, transition } from '../pipeline/stateMachine.js';
import { replayDemoJob } from '../pipeline/demoReplay.js';
import { jobLogger } from '../utils/logger.js';

const idSchema = z.string().min(1);
const gateSchema = z.object({ gate: z.string().min(1) }).strict();
const statusSchema = z.enum(Object.values(JOB_STATUSES));
const approvalStatuses = new Set([
  JOB_STATUSES.ANGLE_APPROVAL,
  JOB_STATUSES.STORYBOARD_APPROVAL,
  JOB_STATUSES.FINAL_APPROVAL,
]);

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function serializeJob(job) {
  return typeof job.toObject === 'function' ? job.toObject() : job;
}

function getRetryStatus(job) {
  const lastApproval = [...(job.approvals || [])].reverse().find(
    (approval) => approval.decision === 'approved',
  );

  if (!lastApproval) {
    return JOB_STATUSES.INTERVIEW;
  }

  const nextStatusByGate = {
    ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
    STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
    FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
  };

  return nextStatusByGate[lastApproval.gate] || JOB_STATUSES.INTERVIEW;
}

/**
 * Creates the job and statistics API router.
 *
 * @param {{ model?: typeof Job, triggerNextStep?: (job: object) => Promise<void> }} options
 * @returns {import('express').Router}
 */
export function createJobsRouter({ model = Job, triggerNextStep = async () => {} } = {}) {
  const router = Router();

  router.get('/jobs', async (request, response, next) => {
    try {
      const status = request.query.status ? statusSchema.parse(request.query.status) : undefined;
      const query = { userId: request.user.id, ...(status ? { status } : {}) };
      const jobs = await model.find(query).sort({ createdAt: -1 });
      response.json({ jobs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/jobs/:id', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const job = await model.findById(id);
      if (!job) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }
      if (String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }

      return response.json({ job: serializeJob(job) });
    } catch (error) {
      next(error);
    }
  });

  async function handleDecision(request, response, next, decision) {
    try {
      const id = idSchema.parse(request.params.id);
      const { gate } = gateSchema.parse(request.body);
      const job = await model.findById(id);

      if (!job) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }
      if (String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }
      if (!approvalStatuses.has(job.status) || gate !== job.status) {
        return errorResponse(
          response,
          400,
          'INVALID_GATE',
          `Gate ${gate} does not match the current job state`,
        );
      }

      const nextStatus =
        decision === 'approved'
          ? {
              ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
              STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
              FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
            }[job.status]
          : JOB_STATUSES.REJECTED;

      transition(job.status, nextStatus);
      const log = jobLogger(job, { operation: 'approval', gate, decision });
      log.info('approval_started', { status: job.status });
      job.approvals.push({ gate, decision, at: new Date() });
      job.status = nextStatus;
      await job.save();

      if (decision === 'approved') {
        await triggerNextStep(job);
      }
      log.info('approval_completed', { status: job.status });

      return response.json({ job: serializeJob(job) });
    } catch (error) {
      next(error);
    }
  }

  router.post('/jobs/:id/approve', (request, response, next) =>
    handleDecision(request, response, next, 'approved'),
  );
  router.post('/jobs/:id/reject', (request, response, next) =>
    handleDecision(request, response, next, 'rejected'),
  );

  router.post('/jobs/:id/retry', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const job = await model.findById(id);
      if (!job) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }
      if (String(job.userId) !== String(request.user.id)) {
        return errorResponse(response, 404, 'JOB_NOT_FOUND', 'Job was not found');
      }
      if (job.status !== JOB_STATUSES.FAILED) {
        return errorResponse(response, 400, 'INVALID_RETRY', 'Only failed jobs can be retried');
      }

      const log = jobLogger(job, { operation: 'retry' });
      log.info('job_retry_started', { status: job.status });
      if (process.env.DEMO_MODE === 'true') {
        const replayed = await replayDemoJob(job);
        log.info('job_retry_completed', { status: replayed.status, source: 'demo-cache' });
        return response.json({ job: serializeJob(replayed) });
      }

      const retryStatus = getRetryStatus(job);
      job.status = retryStatus;
      await job.save();
      await triggerNextStep(job);
      log.info('job_retry_completed', { status: job.status });
      return response.json({ job: serializeJob(job) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/stats', async (_request, response, next) => {
    try {
      const jobs = await model.find({ userId: _request.user.id });
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
      next(error);
    }
  });

  return router;
}
