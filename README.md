# Test Agent

An OpenRouter-powered hiking companion with an Express + Sequelize (SQLite) backend and a React + Vite frontend. It combines an AI chat agent (streaming, tool-aware, weather-aware) with peakbagging/trail list tracking, trip/adventure logging, completions, user profiles, seasons, and email/password authentication.

> **Status:** active development foundation (`v1.0.0`, private package).

## Features

### AI agent (`/agent`)
- Streaming chat (`POST /api/chat`, SSE `token` events) via OpenRouter (OpenAI-compatible client).
- Session history with per-user sessions (`GET /api/sessions`, `GET /api/sessions/:sessionId`).
- Toggleable memory per session (`POST /api/sessions/:sessionId/toggle-memory`).
- Tool-aware replies (web search gating, peak/weather detail tools) with 429 rate-limit handling (respects `Retry-After` / `X-RateLimit-Reset`).
- Configurable primary + fallback models and context-summary model; weather injection via Open-Meteo (overridable).

### Hiking lists & peaks
- Browse lists (`GET /api/lists?type=`), list detail (`GET /api/list/:id`), mountain/trail list detail (`GET /api/mountainList/:listId`, `GET /api/trailList/:listId`).
- Mountain/trail lookup (`GET /api/mountains?state=&range=`, `GET /api/mountain/:id`, `GET /api/trails?state=`, `GET /api/trail/:id`).
- Rich bundled datasets in `server/data/` (NH48, NE67/NE111, ADK46, Catskills, CO/CA 14ers, AT/PCT/CDT/Long Trail, and more).
- Client: filterable list views, completion marking with dates, maps (`@vis.gl/react-google-maps`), markdown rendering.

### Adventures, completions & seasons
- Adventure CRUD (`GET/POST /api/adventures`, `GET/PATCH/DELETE /api/adventure/:id`).
- User profile + list completions (`GET /api/user/profile`, `GET /api/user/list-completions`).
- Seasons browser (`GET /api/seasons`) with seeded season dates and user overrides.
- User preferences (`GET/PATCH /api/user/preferences`).

### Auth
- Email/password register, login, refresh, logout (`POST /api/auth/*`, `GET /api/auth/me`).
- Forgot/reset password flow (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`) — reset link is logged to the server console outside production.
- Session auth via access/refresh tokens, bcrypt-hashed passwords, `requireUser` middleware; client persists sessions and guards routes (`ProtectedRoute`, `AuthContext`).

### Health & infra
- `GET /health` → `{ ok, service: "agent-api", timestamp }`.
- Optional Redis (`ioredis`) cache-aside for user context and peak weather (falls back to in-memory).
- Sequelize + SQLite persistence (`data/memory.db`), migrations + seeders, Vitest suite (server + client).

## Tech stack

| Layer | Libraries |
|---|---|
| Server | Express 5, Sequelize 6 + sqlite3, OpenAI SDK (via OpenRouter), dotenv, zod, bcryptjs, ioredis, cors |
| Client | React 19, React Router 7, Vite 7, MUI Material + Date Pickers, Google Maps (`@vis.gl/react-google-maps`), react-markdown + remark-gfm, dayjs |
| Tooling | TypeScript, tsx, concurrently, Vitest + Testing Library + jsdom, sequelize-cli |

## Project structure

```
.
├── client/                 # React frontend (Vite root)
│   ├── vite.config.ts      # envDir: ../, /api proxy → localhost:3001, outDir ../dist/client
│   └── src/                # App.tsx, auth/, components/, types/, utils/, styles/
├── server/
│   ├── index.ts            # Express app (loads config/loadEnv, mounts /api routers + /health)
│   ├── config/
│   │   ├── loadEnv.ts      # Loads .env then .env.<NODE_ENV> (override: true)
│   │   ├── env.ts          # zod-validated env (NODE_ENV, PORT, CLIENT_URL, OpenRouter, weather, Redis)
│   │   ├── config.json     # Sequelize environments (sqlite storage ../data/memory.db)
│   │   └── session.ts      # Token lifetimes + cache TTLs
│   ├── routes/             # agent, auth, list, mountain, trail, adventure, preferences, profile, season
│   ├── services/           # openrouter, memory, userContext, weather, cache, auth, completion, …
│   ├── agent/              # prompt + tool definitions
│   ├── models/ + migrations/ + seeders/
│   └── data/               # Bundled list/mountain/trail/season JSON datasets
├── tests/                  # Client + shared Vitest tests (+ setup.ts)
├── dist/                   # Build output (dist/server, dist/client)
├── data/                   # Runtime SQLite file(s)
├── .env / .env.development / .env.staging / .env.production / .env.example
└── vitest.config.ts
```

## Prerequisites

- Node.js 22+ (uses `node:` specifiers, `tsx`, Vite 7)
- npm 10+

## Configuration

### Environment files

The server loads `.env` first (shared base/legacy fallback), then overrides it with `.env.<NODE_ENV>` (`server/config/loadEnv.ts`). `NODE_ENV` defaults to `development` when unset. Real host/CI environment variables always win over file values.

The client (Vite, `envDir: "../"`) loads the same files by **mode**: `.env` → `.env.[mode]` (e.g. `--mode staging` reads `.env.staging`). Only `VITE_`-prefixed vars are exposed to the browser.

| File | When used | Purpose |
|---|---|---|
| `.env` | Always (base) | Shared fallback; fills any key missing from the env-specific file |
| `.env.development` | `NODE_ENV=development` (default `npm run dev`) | Local dev keys + `CLIENT_URL=http://localhost:5173` |
| `.env.staging` | `npm run dev:staging`, `start:staging`, `build:staging` | Staging keys/URLs (placeholders — fill in) |
| `.env.production` | `NODE_ENV=production`, `npm start`, `build:production` | Production keys/URLs (placeholders — fill in) |
| `.env.example` | Committed template | Copy to create local files; safe to commit |

> `.env*` (except `.env.example`) is gitignored. Never commit real keys.

### Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` / `staging` / `production` / `test` / `local`. Selects `.env.<NODE_ENV>` and gates dev-only logging (e.g. reset links) |
| `PORT` | No | `3001` | Express listen port (Vite `/api` proxy targets `http://localhost:3001`) |
| `CLIENT_URL` | No | `http://localhost:5173` | Used to build password-reset links |
| `OPENROUTER_API_KEY` | Yes for live AI | — (falls back to `"demo-key"`) | OpenRouter key |
| `OPENROUTER_MODEL` | No | `poolside/laguna-s-2.1:free` | Primary chat model |
| `OPENROUTER_CONTEXT_SUMMARY_MODEL` | No | `nvidia/nemotron-3.5-lightning:free` | Summarization model |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint |
| `OPENROUTER_FALLBACK_MODELS` | No | — | Comma-separated fallback models after 429 budget is exhausted |
| `WEATHER_API_BASE_URL` | No | `https://api.open-meteo.com/v1/forecast` | Forecast provider (keyless default) |
| `REDIS_URL` | No | — (in-memory fallback) | e.g. `redis://localhost:6379` for shared cache |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes for maps | — | Exposed to browser for `Map` component |

### First-time setup

```bash
cp .env.example .env.development   # or edit the existing .env.development
# Edit .env.development with your OPENROUTER_API_KEY and VITE_GOOGLE_MAPS_API_KEY
npm install
npm run db:migrate
npm run db:seed
```

## Running the app

### Development (development env)

```bash
npm run dev              # server (tsx watch :3001) + client (vite :5173) concurrently
npm run dev:server       # backend only — tsx watch server/index.ts
npm run dev:client       # frontend only — vite (proxies /api → :3001)
```

Open http://localhost:5173. Health check: http://localhost:3001/health.

### Staging

```bash
npm run dev:staging       # NODE_ENV=staging server + vite --mode staging client
npm run build:staging     # server tsc + vite build --mode staging
npm run start:staging     # NODE_ENV=staging node dist/server/index.js
```

### Production

```bash
npm run build             # or build:production for --mode production client build
npm start                 # node dist/server/index.js (set NODE_ENV=production in host)
npm run start:production  # NODE_ENV=production node dist/server/index.js
```

Client build output lands in `dist/client`; server output in `dist/server`. Serve `dist/client` statically (or behind your host) with API on `PORT`.

### Database

```bash
npm run db:migrate        # sequelize-cli db:migrate (uses server/config/config.json)
npm run db:migrate:undo
npm run db:seed           # sequelize-cli db:seed:all
npm run db:seed:undo
```

SQLite storage defaults to `data/memory.db` for all Sequelize envs — point `storage` at distinct files per environment before deploying anywhere real.

### Tests & typecheck

```bash
npm test                  # vitest run (server/tests + tests/)
npm run test:watch
npm run typecheck:tests   # tsc -p tests/tsconfig.json
npx tsc -p server/tsconfig.json --noEmit
```

## API reference

The canonical contract lives in [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.0.3, 30 operations across 26 paths). All routes are served under `/api` except `GET /health`. The spec is the source of truth — it stays in sync with the code, while a table here would drift.

Render `docs/openapi.yaml` with any OpenAPI 3.0 viewer, or use the built-in docs:

- **Built-in (recommended):** run the server (`npm run dev:server`) and open http://localhost:3001/api-docs for interactive Swagger UI, or http://localhost:3001/openapi.yaml for the raw spec.
- **Redocly preview:** `npx @redocly/cli preview-docs docs/openapi.yaml`
- **Swagger Editor:** paste contents into [editor.swagger.io](https://editor.swagger.io)
- **VS Code:** install the *OpenAPI (Swagger) Editor* extension and click the Preview button on `docs/openapi.yaml`.

Conventions used across the API: auth-required routes use `requireUser` (bearer access token + refresh flow); validation failures return `400` with flattened details; OpenRouter 429s map to `429` with `Retry-After` passthrough; everything else is `500`. Streaming on `POST /api/chat` uses SSE `token`/`done`/`error` events -- see the `ChatStream`, `ChatDone`, and `ChatStreamError` schemas in the spec.

## Client routes

`/login`, `/register`, `/forgot-password`, `/reset-password` (public) and `/`, `/list/:id`, `/agent`, `/account`, `/settings` (behind `ProtectedRoute`). Unknown paths redirect to `/`.

## Notes & gotchas

- Vite only exposes `VITE_*` vars to the browser — server secrets (`OPENROUTER_API_KEY`, `REDIS_URL`) stay server-side.
- Dev proxy is fixed at `http://localhost:3001`; if you change `PORT`, update `client/vite.config.ts` proxy (and `CLIENT_URL`).
- `NODE_ENV=staging tsx …` / `NODE_ENV=production …` scripts use POSIX env assignment — on Windows use `cross-env` or set the variable in your shell.
- Sequelize `config.json` currently points every environment at the same SQLite file — split `storage` per env for staging/production.

