import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiRouter } from '../src/routes/index.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('dashboard authentication', () => {
  it('rejects protected API requests without a session', async () => {
    process.env.DEMO_USER = 'false';
    process.env.JWT_SECRET = 'test-secret';
    const app = express();
    app.use(express.json());
    app.use(createApiRouter({ model: { find: () => ({ sort: async () => [] }) } }));

    const response = await request(app).get('/api/jobs');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('uses the fixed demo identity when enabled', async () => {
    process.env.DEMO_USER = 'true';
    process.env.DEMO_USER_ID = 'hackathon-demo';
    const app = express();
    app.use(express.json());
    app.use(
      createApiRouter({
        model: {
          find: (query) => ({
            sort: async () => (query.userId === 'hackathon-demo' ? [] : [{ userId: 'other' }]),
          }),
        },
      }),
    );

    const response = await request(app).get('/api/jobs');

    expect(response.status).toBe(200);
    expect(response.body.jobs).toEqual([]);
  });
});
