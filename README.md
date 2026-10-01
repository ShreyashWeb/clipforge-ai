# ClipForge AI

ClipForge AI turns a topic, GitHub repository, or pull request into a source-grounded short video through Telegram.

## Stack

- Node.js, Express, and MongoDB
- grammY, Tavily, and an LLM API
- Flux, ElevenLabs, and Creatomate
- YouTube Data API v3
- React, Vite, and Tailwind CSS

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and configure the required services.
3. Start the API in development with `npm run dev`.
4. Start the dashboard from `dashboard/` with `npm install` and `npm run dev`.

## Scripts

- `npm run dev` - Start the API with file watching.
- `npm start` - Start the API.
- `npm test` - Run tests.

## Project structure

- `src/bot` - Telegram bot integration
- `src/services` - External service adapters
- `src/models` - Mongoose models
- `src/pipeline` - Video production pipeline
- `src/routes` - HTTP routes
- `src/utils` - Shared utilities and infrastructure
- `tests` - Automated tests
- `dashboard` - React dashboard

## Development

Feature implementation is intentionally not included in this initial project structure.