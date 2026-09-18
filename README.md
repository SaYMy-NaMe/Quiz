# Quiz Platform — Google-Forms-style proctored exams

Production-grade online quiz platform: a Google-Forms-style builder (dynamic examinee info schema
+ MCQ answer keys), a strict two-step proctored exam flow for examinees who never log in,
background grading, an instructor-only real-time leaderboard, Excel reporting and
link-exclusive distribution.

## Stack

| Layer    | Technology                                                                    |
|----------|-------------------------------------------------------------------------------|
| Client   | Vite · React 18 · TypeScript (strict) · react-router (lazy routes) · Zustand · Zod |
| Server   | Express · TypeScript (strict) · `node:sqlite` (zero native deps) · Zod · exceljs · pino |
| Shared   | Domain contracts + the examinee schema builder, consumed as TS source via `@shared` |
| Tooling  | npm workspaces · vitest · supertest · ESLint (typescript-eslint strict, type-checked) |

Requires **Node ≥ 22.5** (built-in SQLite). Developed on Node 24.

## Getting started

```bash
npm install
cp server/.env.example server/.env   # optional; defaults work out of the box
npm run dev                          # server :4000 + client :5173 (API proxied)
```

Open http://localhost:5173, register an instructor account, create a quiz, publish it and
copy the share link.

```bash
npm test          # server (54) + client (13) test suites
npm run typecheck # strict TS on both packages
npm run lint      # type-aware ESLint across the monorepo
npm run build     # typecheck server, build client to client/dist
npm start         # production: serves API + built client from one process
```

## Architecture

Modular monolith with clean frontend / backend separation and feature-based modules:

```
client/src/
├── assets/            design tokens + shared stylesheet
├── components/        UI primitives (Google-Forms-style cards, TextField, Modal, Spinner, Navbar)
├── modules/
│   ├── auth/          instructor login/register, session store, RequireAuth / RedirectIfAuthenticated
│   ├── builder/       Google-Forms-style builder: examinee info schema editor + MCQ answer-key editor
│   ├── dashboard/     instructor overview, quiz CRUD, deletion, link generator, responses, analytics
│   ├── examinee/      Step 1 info renderer + dynamic validation → Step 2 timed exam engine → result
│   ├── leaderboard/   instructor-only leaderboard table & ranking hook
│   ├── proctor/       fullscreen lock, tab-switch/blur observers, violation handlers
│   ├── reporting/     credentialed .xlsx downloader + ExportButton
│   └── share/         tokenized link builder, clipboard, invite matrix
├── store/             global state: editor draft (quiz schema), active exam session, timer
├── types/             TypeScript contracts (re-exported shared domain + editor draft types)
├── utils/             countdown observable, formatters, key generator
├── router/            lazy route table + tokenized share loader guard
└── services/          fetch wrapper (typed HttpError), storage adapters

server/src/
├── config/env.ts      zod-validated environment (+ .env loading)
├── container.ts       dependency-injection container wiring repositories → services → routers
├── app.ts             Express app factory (helmet, cors, rate limits, static SPA in production)
├── middleware/        validateBody/bodyOf, asyncHandler, errorHandler, rateLimit
├── modules/
│   ├── auth/          bcrypt credentials, server-side sessions (httpOnly cookie), RBAC guard
│   ├── quiz/          QuestionFactory, quiz state machine, repositories, attempt + submission
│   │                  services, GradingStrategy, upload endpoint
│   ├── examinee/      re-exports the shared schema builder (server-side validation)
│   ├── share/         CSPRNG tokens, PublicAccess / RestrictedAccess strategies, invites, resolver
│   ├── proctor/       violation audit trail + threshold signalling
│   ├── leaderboard/   RankingStrategy, cached ranking engine (event-invalidated), access matrix
│   ├── reporting/     streamed exceljs workbook (Submissions + Answers sheets)
│   └── dashboard/     analytics aggregation
└── services/          database (schema + transactions), event bus, logger
```

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
