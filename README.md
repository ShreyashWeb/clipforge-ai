# ClipForge AI

ClipForge AI turns a topic, GitHub repository, pull request, or release into a source-grounded short video through Telegram.

## Stack

- Node.js, Express, MongoDB, and Mongoose
- grammY, Tavily, Octokit, and an LLM API
- Flux, ElevenLabs, Creatomate, and YouTube Data API v3
- React, Vite, React Router, Tailwind CSS, and React Three Fiber

## Local development

1. Install backend dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set the required values below.
3. Run `npm run check-env` to fail fast on missing production integrations.
4. Start the API with `npm run dev`.
5. In another terminal, run `cd dashboard`, `npm install`, and `npm run dev`.

`/health` returns `{ "status": "ok" }` and can be used by local or hosted health checks.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode (`development`, `test`, or `production`). |
| `PORT` | HTTP port; Render supplies this automatically. |
| `MONGODB_URI` | MongoDB connection string. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token. |
| `TELEGRAM_MODE` | `long_polling` locally or `webhook` in production. |
| `TELEGRAM_WEBHOOK_URL` | Public Telegram webhook endpoint; when omitted on Render it is derived from `RENDER_EXTERNAL_URL`. |
| `TAVILY_API_KEY` | Tavily research API key. |
| `LLM_API_KEY` | LLM provider API key. |
| `LLM_API_URL` | LLM JSON API endpoint. |
| `LLM_MODEL` | LLM model name. |
| `FLUX_API_KEY` | Flux image-generation API key. |
| `FLUX_API_URL` | Flux endpoint. |
| `FLUX_COST_PER_IMAGE` | Cost estimate per generated image. |
| `ELEVENLABS_API_KEY` | ElevenLabs API key. |
| `ELEVENLABS_DEFAULT_VOICE_ID` | Fallback ElevenLabs voice ID. |
| `ELEVENLABS_MODEL_ID` | ElevenLabs model name. |
| `ELEVENLABS_API_URL` | ElevenLabs text-to-speech endpoint. |
| `CREATOMATE_API_KEY` | Creatomate API key. |
| `CREATOMATE_API_URL` | Creatomate API endpoint. |
| `CREATOMATE_WEBHOOK_URL` | Optional Creatomate callback URL. |
| `BACKGROUND_MUSIC_URL` | Optional background music asset URL. |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth client ID. |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth client secret. |
| `YOUTUBE_REDIRECT_URI` | YouTube OAuth redirect URI. |
| `YOUTUBE_REFRESH_TOKEN` | YouTube OAuth refresh token. |
| `YOUTUBE_PRIVACY_STATUS` | Upload privacy (`private`, `unlisted`, or `public`). |
| `GITHUB_TOKEN` | Optional GitHub token for higher API rate limits. |
| `GITHUB_CLIENT_ID` | Dashboard GitHub OAuth client ID. |
| `GITHUB_CLIENT_SECRET` | Dashboard GitHub OAuth client secret. |
| `GITHUB_CALLBACK_URL` | Dashboard GitHub OAuth callback URL. |
| `JWT_SECRET` | Secret used to sign dashboard sessions. |
| `DASHBOARD_ORIGIN` | Allowed dashboard origin for CORS in production. |
| `DASHBOARD_URL` | Local/dashboard URL fallback for CORS. |
| `DEMO_USER` | Enables the fixed demo identity when `true`. |
| `DEMO_USER_ID` | ID used for the demo identity. |
| `DEMO_MODE` | Replays cached research, storyboard images, narration audio, and final video without external paid API calls. |
| `VITE_API_URL` | Dashboard build-time backend origin; never put secrets here. |
| `VITE_DEMO_MODE` | Dashboard build-time mock-data switch. |
| `VITE_BASE_PATH` | Optional Vite base path; defaults to `/clipforge-ai/`. |
| `RENDER_EXTERNAL_URL` | Render-provided public service URL used to derive the Telegram webhook. |

Only `VITE_*` values are sent to the dashboard bundle. Never place API keys, OAuth secrets, or tokens in dashboard environment variables.

When `DEMO_MODE=true`, Telegram `/start <topic>` and `/api/jobs/:id/retry` use recorded research, image, audio, and video fixtures without calling paid providers. This is intended for demos and incident recovery. Completed pipeline results are stored under each job's `pipeline` field so retries can reuse work safely.

## Deployment

### GitHub Pages dashboard

1. In the repository settings, enable GitHub Pages with **GitHub Actions** as the source.
2. Add repository **variables** (not secrets) named `VITE_API_URL` and `VITE_DEMO_MODE`.
3. Push to `main`. `.github/workflows/deploy-dashboard.yml` installs dashboard dependencies, builds with those variables, uploads `dashboard/dist`, and deploys it with the Pages and OIDC actions.
4. The dashboard uses `HashRouter`, so client-side routes work on GitHub Pages. Set `VITE_BASE_PATH` only when the repository name differs from `clipforge-ai`.

### Render backend

1. Create a Render Web Service from this repository. Render can use `render.yaml` as the Blueprint configuration.
2. Add the `sync: false` values in Render's environment settings, especially `MONGODB_URI`, `JWT_SECRET`, the service API keys, and YouTube OAuth values.
3. Set `DASHBOARD_ORIGIN` to the deployed Pages origin.
4. Keep `TELEGRAM_MODE=webhook`. `npm start` runs `src/start.js`, which derives `TELEGRAM_WEBHOOK_URL` from Render's `RENDER_EXTERNAL_URL` when needed before starting Express and registering the webhook.
5. Confirm the Render health check at `/health`, then send `/start <topic-or-github-url>` to the Telegram bot.

## Scripts

- `npm run dev` - Start the API with file watching.
- `npm start` - Start the production API and configure the Telegram webhook.
- `npm run check-env` - Fail fast if required production variables are missing.
- `npm test` - Run backend tests.
- `cd dashboard && npm run build` - Build the dashboard.

## Project structure

- `src/bot` - Telegram bot integration
- `src/services` - Mockable external service adapters
- `src/models` - Mongoose models
- `src/pipeline` - Video production pipeline
- `src/routes` - HTTP routes
- `src/utils` - Shared infrastructure and environment checks
- `tests` - Automated backend tests
- `dashboard` - React dashboard
