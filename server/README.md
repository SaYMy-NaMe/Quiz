# Quiz Platform — Server

REST API for the Quiz Platform. Express 4 + TypeScript (strict) + **Mongoose / MongoDB Atlas**.
Instructor auth (JWT), quiz authoring, tokenized share links, examinee attempts with
server-side shuffling, grading, proctoring audit, instructor-only leaderboard, analytics and
Excel export. Requires **Node ≥ 20**.

## Setup

```bash
cd server
npm install
# create .env (single file — see below), then:
npm run dev        # http://localhost:4000
```

### `.env` (the only configuration file)

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/quiz_platform?retryWrites=true&w=majority
JWT_SECRET=<at least 16 random characters>
CLIENT_ORIGIN=http://localhost:5173
```

`.env` is git-ignored because it holds credentials. Optional extras (defaults in
`src/config/env.ts`): `CLIENT_ORIGINS` (comma-separated extra CORS origins, `https://*.vercel.app`
wildcards allowed), `UPLOAD_DIR`, `CLIENT_DIST`.

**Atlas checklist:** add your machine's / host's IP to the cluster's *Network Access* list.
If it is missing, the server refuses to start and prints exactly that diagnosis (the raw driver
error is a misleading `tlsv1 alert internal error`). While the API is down the client shows
"Cannot reach the server at http://localhost:4000".

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | tsx watch with auto-reload |
| `npm start` | production mode |
| `npm test` | vitest on `mongodb-memory-server` (no Atlas needed) |
| `npm run typecheck` / `npm run lint` | strict TS / type-aware ESLint |

## Data model (Mongoose)

The SQLite schema (7 tables) was redesigned as three document collections:

| Collection | Embeds | Notes |
|---|---|---|
| `users` | — | Instructor accounts. Sessions are stateless JWTs (httpOnly cookie or `Authorization: Bearer`), so there is no sessions collection. |
| `quizzes` | `settings`, `examineeFields[]`, `questions[]` → `options[]` | Everything an instructor authors is read/written together and edited atomically. Questions: `mcq` (any number of options ≥ 2, `correctOptionId`), `short` (`acceptedAnswers[]` for auto-grading), `long` (graded by hand); each has `required` and `points`. Settings include `shuffleQuestions` / `shuffleOptions`. `shareToken` is a sparse unique index. |
| `submissions` | `violationEvents[]`, `answers`, `manualScores`, `questionOrder`, `optionOrder` | One document per attempt from "Start Quiz" (`in_progress`) to `submitted`. The per-attempt shuffle is frozen on the document so refreshes resume identically and grading never depends on presentation order. Indexed for the leaderboard sort. |

Collections and indexes are created by Mongoose on first use — no migration step.

## Architecture

```
src/
├── index.ts               connect → listen (graceful shutdown)
├── app.ts                 Express app (helmet, CORS allow-list, rate limits, static SPA fallback)
├── config/env.ts          zod-validated .env
├── db/mongoose.ts         connection module
├── middleware/            auth guard, validate/bodyOf, asyncHandler, errorHandler, rateLimit, cors, upload
├── shared/                domain contracts (mirrored in client/src/shared)
└── modules/
    ├── auth/              user.model · auth.service (bcrypt + JWT) · auth.controller · auth.routes
    ├── quiz/              quiz.model · question.factory · quiz.state · quiz.schemas (zod) · service · controller · routes
    ├── share/             CSPRNG token · resolveShare middleware · public projection
    ├── examinee/          submission.model · attempt.service (validate/start/resume/violations, shuffle)
    │                      · grading · submission.service (submit/receipt/manual grade/regrade) · controller · routes
    ├── leaderboard/       ranking (Score ↓ → Duration ↑ → Submitted ↑)
    ├── dashboard/         analytics · controller/routes (leaderboard, responses, grading, regrade, export)
    └── reporting/         streamed .xlsx (Submissions · Answers · Summary)
```

Each module is `model → service → controller → routes`; services depend only on models and
other services' public functions (no DI container, no repositories — Mongoose *is* the data layer).

## API

Errors: `{ "error": { "code", "message", "details?" } }`. Instructor routes need the JWT cookie
(`quiz_token`) or a Bearer token. Examinee routes are public; the share token is the credential.
**Answer keys (`correctOptionId`, `acceptedAnswers`) never appear in examinee responses.**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` — GET `/me` | JWT cookie |
| GET / POST | `/api/quizzes` | list (with response stats) / create |
| GET / PUT / DELETE | `/api/quizzes/:id` | edit only while `draft`; delete cascades submissions |
| POST | `/api/quizzes/:id/publish` · `/unpublish` · `/close` · `/reopen` · `/rotate-token` | lifecycle |
| GET | `/api/quizzes/:id/leaderboard` · `/analytics` · `/submissions` · `/export/xlsx` | instructor-only |
| PATCH | `/api/quizzes/:id/submissions/:sid/grade` | `{ grades: { questionId: points } }` for text answers |
| POST | `/api/quizzes/:id/regrade` | re-evaluate all submissions |
| POST | `/api/uploads/image` | multipart `image` ≤ 2 MB |
| GET | `/api/quizzes/v/:token` (alias `/api/share/:token`) | public quiz metadata, no keys |
| POST | `/api/quizzes/v/:token/attempts/validate` | Step 1: validate metadata, creates nothing |
| POST | `/api/quizzes/v/:token/attempts` | Step 2 "Start Quiz": opens the timed attempt, applies shuffles |
| GET | `/api/quizzes/v/:token/attempts/:attemptId` | resume (server clock authoritative) |
| POST | `/api/quizzes/v/:token/attempts/:attemptId/violations` | `{ kind }` → `{ violations, threshold, shouldSubmit }` |
| POST | `/api/quizzes/v/:token/attempts/:attemptId/submit` | `{ answers, reason }` → receipt; required questions block manual submits |
| GET | `/api/quizzes/v/:token/attempts/:attemptId/result` | receipt |
