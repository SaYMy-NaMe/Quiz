# Quiz Platform

A Google-Forms-style platform for **proctored online quizzes**: instructors build quizzes with a
dynamic examinee-info form and MCQ answer keys, share them by private tokenized link, and get
real-time rankings, analytics and Excel exports. Examinees take a strict, fullscreen, timed exam
with tab-switch proctoring — no account required.

## Repository structure

```
Quiz/
├── Server/     Backend — REST API (Express + TypeScript + Prisma/SQLite)   → Server/README.md
├── Client/     Frontend — web app (Vite + React + TypeScript)              → Client/README.md
└── README.md   this overview
```

`Server` and `Client` are **two completely independent applications**. Each one has its own
`package.json`, lockfile, `node_modules`, configuration, environment files, tests, lint setup and
`README.md`. There is no root `package.json`, no root `node_modules` and no shared runtime code:
the only contract between them is the HTTP API the Server exposes and the Client consumes.

| | Server | Client |
|---|---|---|
| Responsibility | Business logic, persistence, auth, grading, exports | UI, routing, exam runtime, proctoring in the browser |
| Runs on | `http://localhost:4000` | `http://localhost:5173` |
| Talks to | the database (Prisma) | the Server, via `VITE_API_BASE_URL` |
| Setup | `cd Server && npm install && npm run dev` | `cd Client && npm install && npm run dev` |

## Quick start

Open two terminals:

```bash
# Terminal 1 — API
cd Server
cp .env.example .env      # defaults work out of the box (SQLite, port 4000)
npm install               # also generates the Prisma client
npm run dev               # creates the database + tables on first boot

# Terminal 2 — web app
cd Client
npm install
npm run dev               # points at http://localhost:4000 (see Client/.env.development)
```

Visit http://localhost:5173, register an instructor account, create and publish a quiz, then
open the share link in a private window to take it as an examinee.

## How the two apps fit together

1. The Client is built with `VITE_API_BASE_URL` pointing at the Server (local or hosted).
2. The Server allows that origin through its CORS allow-list (`CLIENT_ORIGIN` / `CLIENT_ORIGINS`)
   and issues the instructor session as an httpOnly cookie.
3. Examinee links (`/quiz/v/:token`) are resolved by the Client through the public
   `GET /api/share/:token` endpoint — no login, no shared state.
4. The domain contracts (types, constants, examinee-schema validator) are duplicated in
   `Server/src/shared` (source of truth) and `Client/src/shared` so neither app depends on files
   outside its own folder. When you change one, copy it to the other.

## Deployment options

* **Two services** (recommended for hosted setups): deploy `Server` to any Node host and `Client`
  to a static host (Vercel, Netlify, …) with `VITE_API_BASE_URL` set to the API origin and
  `CLIENT_ORIGINS` / `COOKIE_SAMESITE=none` / `HTTPS=true` on the Server.
* **Single service**: build the Client and let the Server serve `Client/dist` (it does so
  automatically when `CLIENT_DIST` points at the build) with an SPA fallback.

See each app's README for configuration, scripts, API reference and architecture notes.
