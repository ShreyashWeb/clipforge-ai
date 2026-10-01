import 'dotenv/config';
import express from 'express';
import { createApiRouter } from './routes/index.js';
import { createBot, startBot, telegramWebhookHandler } from './bot/index.js';
import { logger } from './utils/logger.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use((request, _response, next) => {
  request.log = logger;
  next();
});
app.use(createApiRouter());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

if (process.env.TELEGRAM_BOT_TOKEN && process.env.NODE_ENV !== 'test') {
  const bot = createBot();
  if (process.env.TELEGRAM_MODE === 'webhook') {
    app.post('/telegram/webhook', telegramWebhookHandler(bot));
  } else {
    startBot(bot).catch((error) => {
      logger.error('telegram_bot_start_failed', { error: error.message });
    });
  }
}

app.use((error, _request, response, _next) => {
  if (error instanceof Error && error.name === 'ZodError') {
    return response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || 'Invalid input' },
    });
  }

  logger.error('unhandled_request_error', {
    method: _request.method,
    path: _request.originalUrl,
    error: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`ClipForge AI server listening on port ${port}`);
  });
}

export default app;
