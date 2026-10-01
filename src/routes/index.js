import cors from 'cors';
import { Router } from 'express';
import { createJobsRouter } from './jobs.js';
import { createAuthRouter } from './auth.js';
import { requireAuth } from '../auth/auth.js';

export function createApiRouter(options = {}) {
  const router = Router();
  const { authMiddleware = requireAuth } = options;
  router.use(
    cors({
      origin: process.env.DASHBOARD_URL || 'http://localhost:5173',
    }),
  );
  router.use(createAuthRouter({ ...options, authMiddleware }));
  router.use('/api', authMiddleware, createJobsRouter(options));
  return router;
}
