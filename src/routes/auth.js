import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import {
  consumeTelegramLinkCode,
  setSessionCookie,
} from '../auth/auth.js';
import { requireAuth } from '../auth/auth.js';

const githubTokenUrl = 'https://github.com/login/oauth/access_token';
const githubUserUrl = 'https://api.github.com/user';
const linkSchema = z.object({ code: z.string().trim().min(8).max(32) }).strict();

async function githubFetch(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...options.headers },
      });
      if (!result.ok) throw new Error(`GitHub request failed with status ${result.status}`);
      return await result.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`GitHub authentication failed: ${lastError.message}`);
}

function oauthStateFromCookie(request) {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('github_oauth_state='))
    ?.split('=')[1];
}

/**
 * Creates GitHub OAuth and Telegram account-linking routes.
 *
 * @param {{ userModel?: typeof User, codeModel?: object }} options
 * @returns {import('express').Router}
 */
export function createAuthRouter({
  userModel = User,
  codeModel,
  authMiddleware = requireAuth,
} = {}) {
  const router = Router();

  router.get('/auth/github', (_request, response) => {
    const state = crypto.randomBytes(16).toString('hex');
    response.append(
      'Set-Cookie',
      `github_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    );
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: process.env.GITHUB_CALLBACK_URL || '',
      scope: 'read:user user:email',
      state,
    });
    return response.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  router.get('/auth/github/callback', async (request, response, next) => {
    try {
      if (!request.query.code || request.query.state !== oauthStateFromCookie(request)) {
        return response.status(400).send('Invalid OAuth state');
      }
      const token = await githubFetch(githubTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: request.query.code,
        }),
      });
      const githubUser = await githubFetch(githubUserUrl, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const user = await userModel.findOneAndUpdate(
        { githubId: String(githubUser.id) },
        {
          githubId: String(githubUser.id),
          username: githubUser.login,
          displayName: githubUser.name,
          email: githubUser.email,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      setSessionCookie(response, { id: String(user._id), githubId: user.githubId });
      return response.redirect(process.env.DASHBOARD_URL || 'http://localhost:5173');
    } catch (error) {
      return next(error);
    }
  });

  router.post('/api/auth/telegram/verify', authMiddleware, async (request, response, next) => {
    try {
      const { code } = linkSchema.parse(request.body);
      const user = await consumeTelegramLinkCode(code, request.user.id, {
        codeModel,
        userModel,
      });
      return response.json({ user: { id: user._id, telegramUserId: user.telegramUserId } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
