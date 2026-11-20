# Feynman AI

> Learn by explaining. Mastery appears where your explanation breaks.

Feynman AI is an AI-powered learning platform built around the Feynman Technique. It asks learners to explain what they know, checks their reasoning against their own study material, and exposes the gaps that matter.

## Product loop

```text
Add material → Parse, chunk, embed, and index
           → Explain by voice or text
           → Transcribe and analyze
           → Ask grounded follow-up questions
           → Review strengths, gaps, evidence, and next steps
```

## Highlights

- Voice-first learning sessions over Socket.IO, with text fallback.
- Retrieval grounded in uploaded PDF, DOCX, PPTX, TXT, Markdown, and image content.
- Real-time speech-to-text and AI-generated probing questions.
- Final reports covering confidence, strengths, weaknesses, missed concepts, and follow-up topics.
- Kokoro-82M local text-to-speech on a non-blocking worker thread with FIFO queueing.
- Password and Google OAuth authentication.
- Redis-backed background queues for audio and URL ingestion.

## Architecture

```text
┌──────────────────────┐
│ Next.js web app      │ React 19 · App Router · Tailwind · TypeScript
└──────────┬───────────┘
           │ HTTP / Socket.IO
           ▼
┌──────────────────────┐       ┌─────────────────────┐
│ Express API          │──────▶│ PostgreSQL / Prisma │
│ realtime sessions    │       └─────────────────────┘
└──────┬───────────────┘
       ├──────────────────────▶ Redis / BullMQ
       └──────────────────────▶ Kokoro TTS service
                                  worker_threads · ONNX CPU inference
```

| Component | Technology | Location |
| --- | --- | --- |
| Web application | Next.js 16, React 19, Tailwind CSS, TypeScript | [`web/`](web/) |
| API | Express 5, TypeScript, Socket.IO | [`server/src/`](server/src/) |
| TTS service | Express, `kokoro-js`, Kokoro-82M ONNX | [`server/server.js`](server/server.js) |
| TTS worker | Node `worker_threads`, CPU ONNX inference | [`server/tts-worker.js`](server/tts-worker.js) |
| Database | PostgreSQL, Prisma | [`server/prisma/`](server/prisma/) |
| Jobs | Redis, BullMQ | [`server/src/queues/`](server/src/queues/) |
| Parsing | Python, MarkItDown | [`server/src/services/python/`](server/src/services/python/) |

## Repository layout

```text
web/                    Next.js frontend
server/src/routes/      HTTP route modules
server/src/services/    AI, retrieval, storage, TTS, and domain services
server/src/socket/      Socket.IO realtime session handling
server/src/queues/      BullMQ queue definitions
server/src/workers/     Background queue consumers
server/prisma/          Database schema and migrations
server/server.js        Standalone Kokoro TTS API
server/tts-worker.js    Kokoro inference worker
server/scripts/         Local and deployment scripts
docker-compose.yml      Local PostgreSQL, Redis, and API stack
render.yaml             Render blueprint for core API infrastructure
api_documentation.md    HTTP API reference
```

## Requirements

- Node.js 20 or newer and npm.
- PostgreSQL 16 or a compatible provider.
- Redis 7 or a compatible provider.
- Python 3 for document parsing.
- API keys for the providers enabled in your environment.

## Local development

### Install dependencies

```bash
cd server && npm ci
cd ../web && npm ci
```

### Configure the API

```bash
cp server/.env.example server/.env
```

Fill in the database, authentication, Redis, LLM, embeddings, storage, and OAuth settings. Never commit `.env` or `.env.local` files.

### Start the backend

```bash
cd server
npm run dev:all
```

This starts the API on `http://localhost:8000`, Kokoro TTS on `http://localhost:8125`, and the product worker. In a second terminal:

```bash
cd web
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Start API, product worker, and Kokoro TTS |
| `npm run dev` | Start the API with Nodemon |
| `npm run worker:dev` | Start the product worker only |
| `npm run tts:start` | Start Kokoro TTS only |
| `npm run build` | Type-check and build server declarations |
| `npm run test` | Run server tests |
| `npm run lint` | Run ESLint |
| `npm run smoke:mvp` | Run the end-to-end MVP smoke flow |

## Text-to-speech

The bundled service loads `onnx-community/Kokoro-82M-v1.0-ONNX` once, warms the ONNX graph, and performs inference in a worker thread so CPU-bound speech generation does not block Express.

Local configuration:

```env
TTS_ENABLED=true
TTS_PROVIDER=kokoro
TTS_PORT=8125
KOKORO_TTS_BASE_URL=http://localhost:8125
TTS_MAX_CHARS=600
TTS_TIMEOUT_MS=30000
TTS_MAX_RETRIES=5
```

Check the service:

```bash
curl http://localhost:8125/health
```

Generate speech:

```bash
curl -X POST http://localhost:8125/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Explain Newton’s second law.","voice":"af_heart"}' \
  --output example.wav
```

The endpoint returns `audio/wav`, `Content-Length`, and processes one queued job at a time. Recent identical requests are cached.

## API overview

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | Password authentication, refresh, and Google OAuth |
| `/api/user` | User profile operations |
| `/api/resources` | Create, upload, and manage learning resources |
| `/api/sessions` | Create, update, end, and report on sessions |
| `/api/analytics` | Learning analytics |
| `/api/parser` | Document parsing |
| `/api/tts` | Authenticated speech synthesis |
| `/health` | API dependency health report |
| `/ws` | Socket.IO realtime transport |

See [`api_documentation.md`](api_documentation.md) for request and response examples.

## Deployment

### Render

Deploy the API and Kokoro TTS as separate services.

TTS service settings:

```text
Root Directory: server
Build Command: npm ci
Start Command: npm run tts:start
Health Check Path: /health
```

Let Render provide `PORT`; the TTS server binds to `0.0.0.0` and uses the injected port in production.

API service variables:

```env
TTS_ENABLED=true
TTS_PROVIDER=kokoro
KOKORO_TTS_BASE_URL=https://YOUR-TTS-SERVICE.onrender.com
TTS_MAX_RETRIES=5
```

Add secrets through the Render dashboard, never to Git. See the [Render Web Services documentation](https://render.com/docs/web-services).

### Docker

```bash
docker compose up --build
```

The core API is exposed on port `8000`. Run the web application separately from [`web/`](web/).

### Production frontend

```bash
cd web
npm ci
npm run build
npm start
```

Configure `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_PATH`, and `SESSION_SECRET` from [`web/.env.example`](web/.env.example).

## Security and operational notes

- Keep `.env` files, OAuth secrets, database credentials, Redis URLs, and provider keys out of Git.
- Rotate credentials immediately if they are accidentally exposed.
- Free-tier services may sleep or cold-start, affecting the first request and long-lived WebSocket sessions.
- Kokoro CPU inference requires sufficient memory and startup time; use a persistent disk or suitable Render plan if model downloads on every deploy are undesirable.
- Redis eviction policies can affect BullMQ reliability under memory pressure.

## Contributing

1. Create a focused branch.
2. Keep secrets out of commits.
3. Run the relevant lint, type-check, and test commands.
4. Update API or configuration documentation when behavior changes.
5. Open a pull request with a concise summary and verification notes.

## License

No license has been specified for this project yet.
