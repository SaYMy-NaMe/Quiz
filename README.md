# Quiz Platform

A Google-Forms-style platform for **proctored online quizzes**: instructors build quizzes with a
dynamic examinee-info form and MCQ answer keys, share them by private tokenized link, and get
real-time rankings, analytics and Excel exports. Examinees take a strict, fullscreen, timed exam
with tab-switch proctoring — no account required.

## Repository structure

```
Quiz/
├── server/     Backend — REST API (Express + TypeScript + Mongoose/MongoDB Atlas) → server/README.md
├── client/     Frontend — web app (Vite + React + TypeScript)                   → client/README.md
└── README.md   this overview
```

`server` and `client` are **two completely independent applications**. Each one has its own
`package.json`, lockfile, `node_modules`, configuration, environment files, tests, lint setup and
`README.md`. There is no root `package.json`, no root `node_modules` and no shared runtime code:
the only contract between them is the HTTP API the Server exposes and the Client consumes.

| | Server | Client |
|---|---|---|
| Responsibility | Business logic, persistence, auth, grading, exports | UI, routing, exam runtime, proctoring in the browser |
| Runs on | `http://localhost:4000` | `http://localhost:5173` |
| Talks to | MongoDB Atlas (Mongoose) | the Server, via `src/utils/baseURL.ts` |
| Setup | `cd server && npm install && npm run dev` | `cd client && npm install && npm run dev` |

## Quick start

Open two terminals:

```bash
# Terminal 1 — API
cd server
# create .env with PORT, NODE_ENV, MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN (see server/README.md)
npm install
npm run dev               # collections + indexes are created on first use

# Terminal 2 — web app
cd client
npm install
npm run dev               # targets http://localhost:4000/api (see src/utils/baseURL.ts)
```

Visit http://localhost:5173, register an instructor account, create and publish a quiz, then
open the share link in a private window to take it as an examinee.

## How the two apps fit together

1. The Client targets the Server through `client/src/utils/baseURL.ts` (local or hosted).
2. The Server allows that origin through its CORS allow-list (`CLIENT_ORIGIN`) and issues the
   instructor session as a JWT in an httpOnly cookie.
3. Examinee links (`/quiz/v/:token`) are resolved by the Client through the public
   `GET /api/quizzes/v/:token` endpoint — no login, and answer keys are never included.
4. The domain contracts (types, constants, examinee-schema validator) are duplicated in
   `server/src/shared` (source of truth) and `client/src/shared` so neither app depends on files
   outside its own folder. When you change one, copy it to the other.

## Deployment options

* **Two services** (recommended): deploy `server` to any Node host with its `.env` (Atlas URI,
  JWT secret, `CLIENT_ORIGIN` = the hosted client) and `client` to a static host after switching
  `baseURL.ts` to the hosted API. In production the JWT cookie is `SameSite=None; Secure`.
* **Single service**: build the client and let the server serve `client/dist` (automatic when
  `CLIENT_DIST` points at the build) with an SPA fallback.

See each app's README for configuration, scripts, API reference and architecture notes.
