# Quiz Platform — Server

REST API for the Quiz Platform. Express 4 + TypeScript (strict) + **Prisma** (SQLite locally,
PostgreSQL/Supabase-ready). Handles instructor auth, quiz authoring, tokenized share links,
examinee attempts, grading, proctoring audit, leaderboard, analytics and Excel export.

This folder is a self-contained application: it has its own dependencies, configuration, tests
and lint setup, and knows nothing about the Client except the origins it allows through CORS.

Requires **Node ≥ 22.5**.

## Setup

```bash
cd Server
cp .env.example .env     # adjust if needed (see Configuration)
npm install              # installs deps and runs `prisma generate`
npm run dev              # http://localhost:4000 — database + tables are created automatically
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | tsx watch mode with auto-reload |
| `npm start` | production mode (`NODE_ENV=production`) |
| `npm run build` | `prisma generate` + strict typecheck (the server runs TypeScript directly via tsx) |
| `npm test` | vitest: unit, API (supertest) and integration suites on isolated SQLite clones |
| `npm run typecheck` / `npm run lint` | strict TS / type-aware ESLint |
| `npm run db:migrate` | create a new migration from schema changes (`-- --name <change>`) |
| `npm run db:deploy` | apply pending migrations (what startup does automatically) |
| `npm run db:studio` | Prisma Studio data browser |
| `npm run db:reset` | drop and recreate the local database |

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `DATABASE_URL` | `file:../data/quiz.db` | Prisma connection string. SQLite `file:` paths resolve from `prisma/`; Postgres: `postgresql://…` |
| `AUTO_MIGRATE` | `true` | Run `prisma migrate deploy` at startup (creates file + tables on first run) |
| `UPLOAD_DIR` | `./uploads` | Question/choice images |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Primary allowed CORS origin |
| `CLIENT_ORIGINS` | *(empty)* | Extra origins, comma-separated; `https://*.vercel.app` wildcards allowed |
| `CLIENT_DIST` | `../Client/dist` | If this build exists, it is served with an SPA fallback |
| `SESSION_TTL_HOURS` | `72` | Instructor session lifetime |
| `COOKIE_SAMESITE` | `lax` | `none` when the Client is hosted on another site (requires `HTTPS=true`) |
| `HTTPS` | `false` | `true` behind TLS: secure cookies + `upgrade-insecure-requests` |

### Database

* **Local:** SQLite, zero setup. The schema lives in `prisma/schema.prisma`; versioned SQL in
  `prisma/migrations/` is applied programmatically on boot (`src/db/migrate.ts`).
* **PostgreSQL / Supabase:** set `provider = "postgresql"` in `prisma/schema.prisma`, point
  `DATABASE_URL` at the connection string (Supabase pooler URL with `?pgbouncer=true`), run
  `npx prisma migrate dev --name init-postgres` once. No application code changes: all
  persistence sits behind repository interfaces, and JSON-shaped columns are stored as strings.

## Architecture

```
src/
├── index.ts             startup: migrate → connect → listen (graceful shutdown)
├── app.ts               Express app factory (helmet, CORS allow-list, rate limits, static SPA)
├── container.ts         dependency injection: repositories → services → routers
├── config/env.ts        zod-validated environment
├── db/                  Prisma client factory, transactions, startup migration
├── middleware/          validateBody/bodyOf, asyncHandler, errorHandler, rateLimit, cors
├── shared/              domain contracts (source of truth; mirrored in Client/src/shared)
├── modules/
│   ├── auth/            bcrypt credentials, server-side sessions (httpOnly cookie), RBAC guard
│   ├── quiz/            QuestionFactory, quiz state machine, attempts, grading strategy, regrade
│   ├── share/           CSPRNG tokens, Public/Restricted access strategies, invites
│   ├── examinee/        dynamic examinee-schema validation (Builder/Composite)
│   ├── proctor/         violation audit trail + threshold signalling
│   ├── leaderboard/     ranking strategy, event-invalidated cache (instructor-only)
│   ├── reporting/       streamed .xlsx export (exceljs)
│   └── dashboard/       analytics aggregation
└── test/                isolated per-file SQLite databases for vitest
```

Patterns: Factory (questions/options), Builder/Composite (examinee schema → Zod), Strategy
(grading, access, ranking), Observer (event bus), State (quiz lifecycle), DI container.

## API reference

All responses are JSON. Errors use `{ "error": { "code", "message", "details?" } }`.
Instructor routes require the session cookie set by `/api/auth/*`; examinee routes are public
and keyed by the share token. Answer keys never appear in examinee-facing payloads.

### Auth (instructor)
| Method | Path | Body / notes |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` → sets cookie |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current instructor |

### Quizzes (instructor)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/quizzes` | summaries with response counts |
| POST | `/api/quizzes` | `{ title, description, settings, examineeFields, questions }` |
| GET / PUT / DELETE | `/api/quizzes/:id` | edit only while `draft` |
| POST | `/api/quizzes/:id/publish` · `/unpublish` · `/close` · `/reopen` | lifecycle |
| POST | `/api/quizzes/:id/rotate-token` | new share link, old one dies |
| POST | `/api/quizzes/:id/regrade` | re-evaluate stored submissions |
| GET / POST / DELETE | `/api/quizzes/:id/invites[/:inviteId]` | restricted-mode personal links |
| GET | `/api/quizzes/:id/leaderboard` | Score ↓ → Duration ↑ → Submitted ↑ |
| GET | `/api/quizzes/:id/analytics` · `/submissions` | dashboard data |
| GET | `/api/quizzes/:id/export/xlsx` | streamed workbook (Submissions, Answers, Summary) |
| POST | `/api/uploads/image` | multipart `image` (≤ 2 MB) |

### Examinee (public, by token)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/share/:token[?invite=]` | quiz metadata + examinee fields (alias `/api/quizzes/v/:token`) |
| POST | `/api/share/:token/attempts/validate` | Step 1: validate metadata, creates nothing |
| POST | `/api/share/:token/attempts` | Step 2 "Start Quiz": opens the timed attempt |
| GET | `/api/share/:token/attempts/:attemptId` | resume (server clock authoritative) |
| POST | `/api/share/:token/attempts/:attemptId/violations` | `{ kind }` → `{ violations, threshold, shouldSubmit }` |
| POST | `/api/share/:token/attempts/:attemptId/submit` | `{ answers, reason }` → receipt (idempotent) |
| GET | `/api/share/:token/attempts/:attemptId/result` | receipt |

Unknown, unpublished or unauthorised tokens all return `404`.
