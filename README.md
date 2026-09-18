# Quiz Platform — Google-Forms-style proctored exams

Production-grade online quiz platform: a Google-Forms-style builder (dynamic examinee info schema
+ MCQ answer keys), a strict two-step proctored exam flow for examinees who never log in,
background grading, an instructor-only real-time leaderboard, Excel reporting and
link-exclusive distribution.

## Stack

| App      | Technology                                                                    |
|----------|-------------------------------------------------------------------------------|
| `client/` | Vite · React 18 · TypeScript (strict) · react-router (lazy routes) · Zustand · Zod |
| `server/` | Express · TypeScript (strict) · **Prisma** (SQLite locally, PostgreSQL/Supabase-ready) · Zod · exceljs · pino |
| root     | convenience scripts + type-aware ESLint only — no workspace, no shared dependencies |

`client/` and `server/` are **independent applications**: each has its own `package.json`,
lockfile, `node_modules`, `tsconfig`, `.env` and start scripts, and each can be installed, run,
tested and deployed on its own. Requires Node ≥ 22.5 for the server (Node ≥ 20 for the client).

## Directory structure

```
Quiz/
├── package.json            root convenience scripts (npm --prefix …), ESLint config
├── scripts/sync-shared.mjs mirrors server/src/shared → client/src/shared (--check detects drift)
├── client/                 ───────── independent web app ─────────
│   ├── package.json  package-lock.json  node_modules/
│   ├── .env.example  .env              VITE_API_URL → backend origin
│   ├── vite.config.ts  tsconfig.json  tsconfig.base.json
│   ├── public/_redirects       SPA fallback for static hosts
│   └── src/
│       ├── shared/             vendored domain contracts (mirror of server/src/shared)
│       ├── config/index.ts     apiBaseUrl / assetUrl from VITE_API_URL
│       ├── modules/            auth · builder · dashboard · examinee · leaderboard · proctor · reporting · share
│       ├── store/  types/  utils/  router/  services/  components/  assets/
│       └── main.tsx
└── server/                 ───────── independent API ─────────
    ├── package.json  package-lock.json  node_modules/
    ├── .env.example  .env              PORT, NODE_ENV, DATABASE_URL, …
    ├── prisma/
    │   ├── schema.prisma       data model (provider: sqlite → postgresql when you migrate)
    │   └── migrations/         versioned SQL applied automatically at startup
    ├── data/quiz.db            SQLite file (auto-created; git-ignored)
    ├── tsconfig.json  tsconfig.base.json  vitest.config.ts
    └── src/
        ├── index.ts            startup: migrate → connect → listen (graceful shutdown)
        ├── app.ts              Express app factory
        ├── container.ts        dependency-injection wiring
        ├── config/env.ts       zod-validated environment (+ .env loading)
        ├── db/prisma.ts        PrismaClient factory, transaction + JSON helpers
        ├── db/migrate.ts       programmatic `prisma migrate deploy`
        ├── shared/             domain contracts (source of truth)
        ├── modules/            auth · quiz · share · examinee · proctor · leaderboard · reporting · dashboard
        ├── middleware/  services/  utils/
        └── test/               isolated per-file SQLite clones for vitest
```

## Running each app independently

```bash
# --- server (API on :4000) ---
cd server
cp .env.example .env          # edit PORT / DATABASE_URL if needed
npm install                   # also runs `prisma generate`
npm run dev                   # tsx watch; creates data/quiz.db + tables on first boot
npm start                     # production mode (same auto-migration)
npm test  ·  npm run typecheck  ·  npm run db:studio

# --- client (Vite on :5173) ---
cd client
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # or: npm run build && npm run preview
npm test  ·  npm run typecheck

# --- both at once, from the root (optional) ---
npm install                   # root tooling only (eslint, concurrently)
npm run install:all
npm run dev                   # concurrently: server + client
npm run lint  ·  npm run check:shared
```

The client calls `${VITE_API_URL}/api/...` with `credentials: 'include'`; the server allows that
origin via `CLIENT_ORIGIN` (CORS with credentials). Leave `VITE_API_URL` empty to use the Vite
proxy / same-origin mode instead.

## Database layer (Prisma)

* **Local development: SQLite.** `DATABASE_URL="file:../data/quiz.db"` (relative `file:` paths
  resolve from `server/prisma/`). Nothing to install or create by hand.
* **Automatic schema creation.** On every startup (`AUTO_MIGRATE=true`, the default) the server
  runs `prisma migrate deploy` programmatically ([server/src/db/migrate.ts](server/src/db/migrate.ts)):
  a missing SQLite file is created, missing tables/indexes are created, and previously applied
  migrations are skipped (tracked in `_prisma_migrations`).
* **Modular access.** All persistence sits behind repository interfaces
  (`AuthRepository`, `QuizRepository`, `InviteRepository`, `AttemptRepository`) implemented with
  the Prisma client; services and routers never see SQL or the driver. JSON-shaped columns
  (examinee fields, questions, answers) are `String` in the schema and (de)serialised at the
  repository boundary — portable across SQLite and Postgres.
* **Switching to PostgreSQL / Supabase** (no business-logic changes):
  1. `prisma/schema.prisma`: `provider = "postgresql"`
  2. `.env`: `DATABASE_URL` = Supabase pooler URL (`?pgbouncer=true`), optionally `DIRECT_URL`
     for migrations (add `directUrl = env("DIRECT_URL")` to the datasource)
  3. `npx prisma migrate dev --name init-postgres` once, then startup auto-migration continues
     to apply future migrations.
* Schema changes: edit `schema.prisma` → `npm run db:migrate -- --name <change>` → commit the
  generated migration folder.

## Architecture

Feature-based modules on both sides (see the tree above).

### Design patterns

| Pattern   | Where                                                                                     |
|-----------|-------------------------------------------------------------------------------------------|
| Factory   | `QuestionFactory` / `OptionFactory` (server), `DraftFactory` (client), `FieldValidatorFactory` |
| Builder / Composite | `ExamineeSchemaBuilder` composes per-field Zod validators into the runtime object schema (shared by client + server) |
| Strategy  | `GradingStrategy` (standard, negative marking), `AccessStrategy` (public / restricted), `RankingStrategy` (score → duration → timestamp) |
| Observer  | `createCountdown` (timer ticks/expiry), `createProctor` (focus-loss events), server `EventBus` (`submission:created`, `attempt:violation`) |
| State     | `quiz.state.ts` — Draft → Published → Closed with guarded transitions; attempts move in_progress → submitted |
| DI        | `createContainer()` — every module exposes `create*` factories receiving explicit collaborators |

## Key flows

**Roles.** Only instructors authenticate (bcrypt + server-side sessions in an httpOnly cookie).
Examinees need no account: the only entry point is a tokenized link.

**Builder (instructor).** Two Google-Forms-style editors: the *examinee info schema* (Student ID,
Name, Email, Course Code, Section … as text / number / email / dropdown, required or optional) and
the *MCQ questionnaire* (2–6 choices, text or image prompts for questions **and** choices, an
explicit answer-key radio per question, points). Toggles control whether examinees see their
**score** and/or the **answer key** after submitting.

**Link-exclusive access.** Publishing issues a 22-char CSPRNG token (132 bits). Unknown tokens,
unpublished quizzes and restricted quizzes without a valid `?invite=` all return the same 404.
Quizzes are never listed publicly; a leaked link can be rotated from the dashboard.

**Two-step exam.**
*Step 1* renders the instructor-defined fields and validates them (client for UX, then
`POST …/attempts/validate` on the server — no attempt, no timer, no proctoring). The clean record
is held locally as a *pending examinee*.
*Step 2* shows the rules and a **Start Quiz** button. That click requests fullscreen, opens the
attempt on the server (which sets the deadline), starts the countdown and arms proctoring. The
countdown derives remaining time from the server deadline + clock offset, so a refresh resumes
with the same clock; answers, attempt id and violation count persist in `localStorage` per token.
An omnipresent floating timer stays visible while scrolling.

**Proctoring (Step 2 only).** `visibilitychange`, window `blur` and `fullscreenchange` are hard
violations (de-duplicated within 1.5 s); common navigation/devtools shortcuts, the context menu and
copy/cut are blocked; `beforeunload` prompts. OS-level Alt+Tab / Cmd+Tab cannot be cancelled by any
page and are detected post-hoc via blur/visibility. The **second** hard violation auto-submits
(`reason=violation`). Browser controls unlock (fullscreen released, listeners removed) immediately
upon submission.

**Grading.** Answer keys never leave the server before submission (every examinee payload is
stripped; a test pins this). Submissions are idempotent; late submissions are stamped `timeout`.
Instructors can **regrade** all stored submissions after correcting a key.

**Leaderboard (instructor-only).** Score ↓ → Duration ↑ → SubmittedAt ↑, cached per quiz and
invalidated by submission / regrade events. There is no examinee-facing ranking route at all.

**Reporting.** `GET /api/quizzes/:id/export/xlsx` streams a workbook: *Submissions* (one column per
examinee field + Score, Max, %, Time Taken, Started/Submitted ISO-8601, Violations, Reason),
*Answers* (every submission × question) and *Summary* (metadata + per-question correct rates).

## Deploying & sharing links

A copied share link (`/quiz/v/<token>`) must work in a fresh tab, another browser or incognito —
it is resolved from the **public API** (`GET /api/share/:token`, alias `GET /api/quizzes/v/:token`)
with no cookies or headers, and the client route is declared outside every auth guard.

* **Single process (recommended):** `npm run build && npm start`. Express serves `client/dist`
  with an SPA fallback for every non-`/api`, non-`/uploads` GET whenever the build exists
  (independent of `NODE_ENV`).
* **Vite dev / preview:** history-API fallback is on (`appType: 'spa'`); `/api` is proxied to :4000.
* **Static hosts:** `client/public/_redirects` (Netlify-style `/* /index.html 200`) ships with the
  build; point `apiBaseUrl` at your API origin and set `CLIENT_ORIGIN` for CORS.
* **Plain-http deployments (LAN, staging):** leave `HTTPS=false` — with it on, the CSP adds
  `upgrade-insecure-requests` and the session cookie becomes `Secure`, which breaks http clients.

## API summary

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` · `/login` · `/logout` — GET `/me` | cookie session |
| GET/POST | `/api/quizzes` · GET/PUT/DELETE `/api/quizzes/:id` | instructor |
| POST | `/api/quizzes/:id/publish` · `/unpublish` · `/close` · `/reopen` · `/rotate-token` · `/regrade` | instructor |
| GET/POST/DELETE | `/api/quizzes/:id/invites[/:inviteId]` | instructor |
| GET | `/api/quizzes/:id/leaderboard` · `/analytics` · `/submissions` · `/export/xlsx` | instructor |
| POST | `/api/uploads/image` | instructor |
| GET | `/api/share/:token[?invite=]` | token |
| POST | `/api/share/:token/attempts/validate` (Step 1) · `/attempts` (Start Quiz) — GET `/:attemptId` | token |
| POST | `/api/share/:token/attempts/:attemptId/submit` · `/violations` — GET `/result` | token |
