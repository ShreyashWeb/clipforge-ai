import 'dotenv/config';

if (!process.env.TELEGRAM_WEBHOOK_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.TELEGRAM_WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/telegram/webhook`;
}
if (process.env.TELEGRAM_WEBHOOK_URL) {
  process.env.TELEGRAM_MODE = 'webhook';
}

await import('./server.js');
