Project: ClipForge AI, a Telegram-driven agent that turns a topic (or a GitHub repo/PR) into a source-grounded short video.
Stack: Node.js (ESM), Express, MongoDB (Mongoose), grammY for Telegram, Tavily for search, an LLM API for reasoning, Flux for storyboard images, ElevenLabs for voice, Creatomate for rendering, YouTube Data API v3, React + Vite + Tailwind for the dashboard.
Rules:

- Keep each external service behind its own module in /src/services with a clear interface so it can be mocked.
- Every job moves through a state machine: INTERVIEW -> ANGLE\_APPROVAL -> SCRIPT -> STORYBOARD\_APPROVAL -> RENDER -> FINAL\_APPROVAL -> PUBLISHED. Never call a paid API (voice, render) before the previous approval gate is passed.
- Never hardcode secrets; read from process.env and keep .env.example updated.
- Wrap every external call with timeout, retry with backoff, and a clear error message sent back to the user.
- Write small functions, JSDoc on public functions, and a unit test for each service using mocks.
