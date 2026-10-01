import 'dotenv/config';

const required = [
  'MONGODB_URI',
  'JWT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TAVILY_API_KEY',
  'LLM_API_KEY',
  'LLM_API_URL',
  'FLUX_API_KEY',
  'ELEVENLABS_API_KEY',
  'CREATOMATE_API_KEY',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REDIRECT_URI',
  'YOUTUBE_REFRESH_TOKEN',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Environment variables are configured.');
}
