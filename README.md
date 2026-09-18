# Quiz Platform

Production-grade online quiz platform: strict timed proctoring, dynamic leaderboards,
automated grading, dynamic examinee metadata collection, Excel reporting and
link-exclusive quiz distribution.

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
npm test          # server (48) + client (9) test suites
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

**Link-exclusive access.** Publishing issues a 22-char CSPRNG token (132 bits). The only entry
point is `/quiz/v/:token`; unknown tokens, unpublished quizzes and restricted quizzes without
a valid `?invite=` all return the same 404. Quizzes are never listed publicly.

**Examinee wizard.** Step 1 renders the instructor-defined fields and validates them with the
dynamically synthesised Zod schema (client for UX, server as the authority). Step 2 opens a
timed attempt; the server owns `expiresAt`. The client countdown derives remaining time from
the deadline + server clock offset, so refreshes never reset the timer. Answers, attempt id and
violation count persist in `localStorage` per token.

**Proctoring.** Fullscreen is requested inside the Step-1 click. `visibilitychange`, window
`blur` and `fullscreenchange` are hard violations (de-duplicated within 1.5 s); common
navigation/devtools shortcuts and the context menu are blocked. The second hard violation
auto-submits with `reason=violation`. The server records every violation.

**Grading & leaderboard.** Submissions are idempotent; late submissions are stamped
`timeout`. Rankings use Score ↓ → Duration ↑ → SubmittedAt ↑. Instructors can hide the board
from examinees at any time; the public board never exposes other examinees' metadata.

**Reporting.** `GET /api/quizzes/:id/export/xlsx` streams a workbook: one column per examinee
field, plus Score, Max, %, Time Taken (s / hh:mm:ss), Started/Submitted ISO-8601, Violations,
Reason; a second sheet lists every (submission, question) answer.

## API summary

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` · `/login` · `/logout` — GET `/me` | cookie session |
| GET/POST | `/api/quizzes` · GET/PUT/DELETE `/api/quizzes/:id` | instructor |
| POST | `/api/quizzes/:id/publish` · `/unpublish` · `/close` · `/reopen` | instructor |
| PATCH | `/api/quizzes/:id/leaderboard-visibility` | instructor |
| GET/POST/DELETE | `/api/quizzes/:id/invites[/:inviteId]` | instructor |
| GET | `/api/quizzes/:id/leaderboard` · `/analytics` · `/submissions` · `/export/xlsx` | instructor |
| POST | `/api/uploads/image` | instructor |
| GET | `/api/share/:token[?invite=]` | token |
| POST | `/api/share/:token/attempts` — GET `/:attemptId` | token |
| POST | `/api/share/:token/attempts/:attemptId/submit` · `/violations` — GET `/result` | token |
| GET | `/api/share/:token/leaderboard` | token (+ visibility flag) |
