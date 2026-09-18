# Quiz Platform — Client

Web frontend for the Quiz Platform. Vite + React 18 + TypeScript (strict), react-router (lazy
routes), Zustand stores, Zod validation. It contains no backend logic: everything it knows comes
from the Server's REST API.

This folder is a self-contained application with its own dependencies, configuration, tests
and lint setup. Requires **Node ≥ 20**.

## Setup

```bash
cd Client
npm install
npm run dev          # http://localhost:5173 → API at http://localhost:4000
```

The Server must be running (see `../Server/README.md`) unless you point the Client at a hosted
API (below).

### Scripts

| Script | Mode / env file | Talks to |
|---|---|---|
| `npm run dev` | development · `.env.development` | `http://localhost:4000` |
| `npm run dev:remote` | remote · `.env.remote` | hosted API |
| `npm run build` | production · `.env.production` | hosted API |
| `npm run build:local` | development · `.env.development` | local API |
| `npm run preview` / `npm start` | serves the last build on :5173 | |
| `npm test` · `npm run typecheck` · `npm run lint` | vitest (jsdom) · strict TS · ESLint | |

## Configuration

The only setting is the API origin, read at build time from the env file of the active Vite mode:

```env
# Client/.env.development   (npm run dev)
VITE_API_BASE_URL=http://localhost:4000

# Client/.env.production    (npm run build)
VITE_API_BASE_URL=https://your-app.vercel.app
```

* Override any mode without touching git: `echo 'VITE_API_BASE_URL=https://staging.example' > .env.local`
* Leave it **empty** for same-origin mode: the Vite dev proxy forwards `/api` and `/uploads` to
  `http://localhost:4000` (`VITE_PROXY_TARGET` to change), and in production the Server can serve
  this build itself.
* `VITE_API_URL` is accepted as a legacy alias.

## API integration

All HTTP traffic goes through one module, `src/utils/api.ts`:

```ts
import { api, apiFetch, HttpError } from '@/utils/api';

const { quizzes } = await api.get<{ quizzes: QuizSummary[] }>('/quizzes');
await api.post('/quizzes/123/publish');
const res = await apiFetch('/quizzes/123/export/xlsx');   // raw Response (blob download)
```

* `src/utils/constants.ts` resolves `API_BASE_URL` (`${VITE_API_BASE_URL}/api`) and `assetUrl()`
  for server-hosted images.
* Requests are sent with `credentials: 'include'` so the instructor session cookie works
  cross-origin (the Server must list this origin in `CLIENT_ORIGINS`).
* Errors are thrown as `HttpError { status, code, message, details }` built from the Server's
  error envelope; a `401` on an instructor endpoint expires the cached session and redirects to
  `/login`.
* Each feature module wraps its endpoints in a `*.api.ts` file (`modules/builder/services/quiz.api.ts`,
  `modules/examinee/services/attempt.api.ts`, …) — components never call `fetch` directly.

## Structure

```
src/
├── utils/           api.ts (HTTP client) · constants.ts (env) · countdown.ts · format.ts
├── shared/          domain contracts mirrored from Server/src/shared (types, constants, schema builder)
├── router/          route table: public /quiz/v/:token outside the auth guard; share loader
├── store/           editor draft · active exam session (localStorage) · timer
├── modules/
│   ├── auth/        instructor login/register, session guards
│   ├── builder/     Google-Forms-style quiz builder (examinee schema + MCQ answer keys)
│   ├── dashboard/   quiz management, responses, analytics, lifecycle actions
│   ├── examinee/    Step 1 info form → Step 2 timed exam → result
│   ├── proctor/     fullscreen lock, tab-switch/blur observers, violation handling
│   ├── leaderboard/ instructor-only rankings
│   ├── reporting/   .xlsx download
│   └── share/       share links, invites, clipboard
├── components/      UI primitives (cards, modal, spinner, navbar, error pages)
├── services/        storage adapters
└── types/           TypeScript contracts
```

## Examinee flow (what the Client guarantees)

1. `/quiz/v/:token` opens for anyone — no login, resolved from the public API.
2. Step 1 collects the instructor-defined details (validated locally and on the Server).
3. "Start Quiz" requests fullscreen, opens the attempt (timer starts server-side) and arms
   proctoring; the floating timer survives refreshes (server clock is authoritative).
4. Two tab-switch/blur/fullscreen-exit violations auto-submit; submission releases all locks.
