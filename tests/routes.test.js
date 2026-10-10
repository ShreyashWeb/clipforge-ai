import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiRouter } from '../src/routes/index.js';
import { emitTraceEvent } from '../src/services/jobs.js';

function createJob(overrides = {}) {
  return {
    _id: 'job-1',
    userId: 'demo-user',
    status: 'ANGLE_APPROVAL',
    approvals: [],
    trace: [
      { step: 'web_research', tool: 'tavily', ms: 120, ok: true, at: new Date('2026-01-01T00:01:00Z') },
    ],
    costEstimate: 12,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T01:00:00Z'),
    save: vi.fn(async function save() {
      return this;
    }),
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function createApp(model, triggerNextStep = vi.fn(async () => {}), agentLoop = vi.fn(async () => {})) {
  const app = express();
  app.use(express.json());
  app.use(
    createApiRouter({
      model,
      triggerNextStep,
      agentLoop,
      authMiddleware: (req, _res, next) => {
        req.user = { id: 'demo-user' };
        next();
      },
    }),
  );
  app.use((error, _req, res, _next) => {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const status = error.status || 500;
    return res.status(status).json({
      error: { code: error.code || 'INTERNAL_ERROR', message: error.message },
    });
  });
  return { app, triggerNextStep, agentLoop };
}

function modelFor(job) {
  return {
    find: vi.fn(() => ({ sort: vi.fn(async () => (job ? [job] : [])) })),
    findById: vi.fn(async () => job),
  };
}

describe('job REST routes & service functions', () => {
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

  it('rejects invalid status filter with validation error', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app).get('/api/jobs?status=NON_EXISTENT_STATUS');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a full job by id', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app).get('/api/jobs/job-1');

    expect(response.status).toBe(200);
    expect(response.body.job._id).toBe('job-1');
  });

  it('returns 404 when job does not exist or belongs to another user', async () => {
    const { app } = createApp({
      find: vi.fn(),
      findById: vi.fn(async () => null),
    });
    const response = await request(app).get('/api/jobs/job-999');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('approves a matching gate and triggers the next step / resumes agent', async () => {
    const { app, triggerNextStep } = createApp(modelFor(job));
    const response = await request(app)
      .post('/api/jobs/job-1/approve')
      .send({ gate: 'ANGLE_APPROVAL' });

    expect(response.status).toBe(200);
    expect(job.status).toBe('SCRIPT');
    expect(job.approvals[0].decision).toBe('approved');
    expect(job.approvals[0].gate).toBe('ANGLE_APPROVAL');
    expect(triggerNextStep).toHaveBeenCalledWith(job);
  });

  it('rejects mismatched gates with 400 INVALID_GATE', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app)
      .post('/api/jobs/job-1/approve')
      .send({ gate: 'FINAL_APPROVAL' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_GATE');
  });

  it('rejects an invalid request body without gate with 400 VALIDATION_ERROR', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app)
      .post('/api/jobs/job-1/approve')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a job at an approval gate', async () => {
    const { app } = createApp(modelFor(job));
    const response = await request(app)
      .post('/api/jobs/job-1/reject')
      .send({ gate: 'ANGLE_APPROVAL' });

    expect(response.status).toBe(200);
    expect(job.status).toBe('REJECTED');
    expect(job.approvals[0].decision).toBe('rejected');
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

  it('returns 400 INVALID_RETRY when attempting to retry a non-failed job', async () => {
    job = createJob({ status: 'INTERVIEW' });
    const { app } = createApp(modelFor(job));
    const response = await request(app).post('/api/jobs/job-1/retry');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_RETRY');
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

  it('streams trace events via SSE on GET /api/jobs/:id/stream', async () => {
    const { app } = createApp(modelFor(job));

    // Request the SSE stream endpoint
    const responsePromise = request(app)
      .get('/api/jobs/job-1/stream')
      .buffer(true)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          // Once we have our initial trace event, emit another one and then end
          if (data.includes('web_research')) {
            emitTraceEvent('job-1', { step: 'make_storyboard', tool: 'flux', ms: 500, ok: true });
            setTimeout(() => {
              res.destroy();
              callback(null, data);
            }, 50);
          }
        });
        res.on('end', () => callback(null, data));
        res.on('error', (err) => callback(err, data));
      });

    const response = await responsePromise;
    const bodyText = typeof response.body === 'string' ? response.body : response.text || '';
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(bodyText).toContain('web_research');
    expect(bodyText).toContain('tavily');
  });

  it('returns 404 on SSE stream for unknown job', async () => {
    const { app } = createApp({
      find: vi.fn(),
      findById: vi.fn(async () => null),
    });
    const response = await request(app).get('/api/jobs/non-existent/stream');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('JOB_NOT_FOUND');
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

  it('configures CORS from environment origin', async () => {
    const prevOrigin = process.env.DASHBOARD_ORIGIN;
    process.env.DASHBOARD_ORIGIN = 'https://dashboard.clipforge.ai';
    const { app } = createApp(modelFor(job));
    const response = await request(app)
      .options('/api/jobs')
      .set('Origin', 'https://dashboard.clipforge.ai')
      .set('Access-Control-Request-Method', 'GET');

    if (prevOrigin === undefined) delete process.env.DASHBOARD_ORIGIN;
    else process.env.DASHBOARD_ORIGIN = prevOrigin;

    expect(response.headers['access-control-allow-origin']).toBe('https://dashboard.clipforge.ai');
  });
});

