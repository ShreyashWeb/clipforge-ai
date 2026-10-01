import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { TelegramLinkCode } from '../models/TelegramLinkCode.js';

const cookieName = 'clipforge_token';
const linkCodeLifetimeMs = 10 * 60 * 1000;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.DEMO_USER !== 'true') {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret || 'demo-only-secret';
}

function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(';') || [];
  const match = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Signs a dashboard session token.
 *
 * @param {{ id: string, githubId?: string }} user
 * @returns {string}
 */
export function signSession(user) {
  return jwt.sign({ sub: user.id, githubId: user.githubId }, jwtSecret(), { expiresIn: '7d' });
}

/**
 * Protects routes with the dashboard JWT cookie.
 *
 * @returns {import('express').RequestHandler}
 */
export function requireAuth(request, response, next) {
  if (process.env.DEMO_USER === 'true') {
    request.user = { id: process.env.DEMO_USER_ID || 'demo-user', demo: true };
    return next();
  }

  const token = readCookie(request, cookieName);
  if (!token) {
    return response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    request.user = { id: payload.sub, githubId: payload.githubId };
    return next();
  } catch {
    return response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });
  }
}

/**
 * Adds a session cookie to a response.
 *
 * @param {import('express').Response} response
 * @param {{ id: string, githubId?: string }} user
 */
export function setSessionCookie(response, user) {
  const flags = [
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${7 * 24 * 60 * 60}`,
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ];
  response.append('Set-Cookie', `${cookieName}=${encodeURIComponent(signSession(user))}; ${flags.join('; ')}`);
}

/**
 * Creates a one-time code for the Telegram bot to send to a user.
 *
 * @param {string|number} telegramUserId
 * @param {{ model?: typeof TelegramLinkCode }} options
 * @returns {Promise<string>}
 */
export async function createTelegramLinkCode(telegramUserId, { model = TelegramLinkCode } = {}) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await model.create({
    telegramUserId: String(telegramUserId),
    codeHash,
    expiresAt: new Date(Date.now() + linkCodeLifetimeMs),
  });
  return code;
}

/**
 * Consumes a valid Telegram code and links it to the logged-in account.
 *
 * @param {string} code
 * @param {string} userId
 * @param {{ codeModel?: typeof TelegramLinkCode, userModel?: typeof User }} options
 * @returns {Promise<object>}
 */
export async function consumeTelegramLinkCode(
  code,
  userId,
  { codeModel = TelegramLinkCode, userModel = User } = {},
) {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const link = await codeModel.findOneAndUpdate(
    { codeHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!link) throw new Error('Invalid or expired Telegram link code');

  const user = await userModel.findByIdAndUpdate(
    userId,
    { $set: { telegramUserId: link.telegramUserId } },
    { new: true },
  );
  if (!user) throw new Error('Account was not found');
  return user;
}

export const AUTH_COOKIE_NAME = cookieName;
