import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiRouter } from '../src/routes/index.js';

function createJob(overrides = {}) {
  return {
    _id: 'job-1',
    userId: 'demo-user',
    status: 'ANGLE_APPROVAL',
    approvals: [],
    costEstimate: 12,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T01:00:00Z'),
    save: vi.fn(async function save() {
      return this;
    }),
    ...overrides,
  };
}

function createApp(model, triggerNextStep = vi.fn(async () => {})) {
  const app = express();
  app.use(express.json());
  app.use(
    createApiRouter({
      model,
      triggerNextStep,
      authMiddleware: (request, _response, next) => {
        request.user = { id: 'demo-user' };
        next();
      },
    }),
  );
  app.use((error, _request, response, _next) => {
    if (error.name === 'ZodError') {
      return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  });
  return { app, triggerNextStep };
}

function modelFor(job) {
  return {
    find: vi.fn(() => ({ sort: vi.fn(async () => (job ? [job] : [])) })),
    findById: vi.fn(async () => job),
  };
}

describe('job routes', () => {
  let job;

  beforeEach(() => {
    job = createJob();
  });

  it('lists newest jobs and supports status filtering', async () => {
    const model = modelFor(job);
    const { app } = createApp(model);
    const response = await request(app).get('/api/jobs?status=ANGLE_APPROVAL');

    expect(response.status).toBe(200);
    expect(response.body.jobs).toHaveLength(1);
    expect(model.find).toHaveBeenCalledWith({ status: 'ANGLE_APPROVAL', userId: 'demo-user' });
  });

  it('returns a full job by id', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app).get('/api/jobs/job-1');

    expect(response.status).toBe(200);
    expect(response.body.job._id).toBe('job-1');
  });

  it('approves a matching gate and triggers the next step', async () => {
    const { app, triggerNextStep } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/approve').send({ gate: 'ANGLE_APPROVAL' });

    expect(response.status).toBe(200);
    expect(job.status).toBe('SCRIPT');
    expect(job.approvals[0].decision).toBe('approved');
    expect(triggerNextStep).toHaveBeenCalledWith(job);
  });

  it('rejects mismatched gates', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/approve').send({ gate: 'FINAL_APPROVAL' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_GATE');
  });

  it('rejects a job at an approval gate', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/reject').send({ gate: 'ANGLE_APPROVAL' });

    expect(response.status).toBe(200);
    expect(job.status).toBe('REJECTED');
  });

  it('retries failed jobs from the last approved gate', async () => {
    job = createJob({
      status: 'FAILED',
      approvals: [{ gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date() }],
    });
    const { app, triggerNextStep } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/retry');

    expect(response.status).toBe(200);
    expect(job.status).toBe('RENDER');
    expect(triggerNextStep).toHaveBeenCalledWith(job);
  });

  it('replays a failed job from cached media in demo mode', async () => {
    const previousDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    job = createJob({ status: 'FAILED' });
    const { app, triggerNextStep } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/retry');
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;

    expect(response.status).toBe(200);
    expect(job.status).toBe('PUBLISHED');
    expect(job.audioUrl).toContain('clipforge-demo');
    expect(job.videoUrl).toContain('clipforge-demo');
    expect(triggerNextStep).not.toHaveBeenCalled();
  });

  it('returns aggregate stats', async () => {
    const published = createJob({ status: 'PUBLISHED' });
    const { app } = createApp({
      find: vi.fn(async () => [published, job]),
      findById: vi.fn(),
    });
    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body.jobsCount).toBe(2);
    expect(response.body.averageTimePerVideo).toBe(3600000);
    expect(response.body.estimatedCostSaved).toBe(24);
  });
});
