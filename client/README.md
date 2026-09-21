# Quiz Platform — Client

Web frontend: Vite + React 18 + TypeScript (strict), react-router, Zustand, Zod. It contains no
backend logic — everything comes from the Server's REST API. Requires **Node ≥ 20**.

## Setup

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

## Pointing at a server

`src/utils/baseURL.ts` is the only place to change — comment/uncomment the target:

```ts
export const BASE_URL = 'http://localhost:4000/api';
// export const BASE_URL = 'https://your-production-backend.vercel.app/api';
```

Every request goes through `src/utils/api.ts` (`api.get/post/put/patch/delete`, `apiFetch` for
downloads, typed `HttpError`, session-expiry observer) using `BASE_URL`; `assetUrl()` in
`src/utils/constants.ts` resolves server-hosted images. Requests carry `credentials: 'include'`
so the JWT cookie works cross-origin — the Server must list this origin in `CLIENT_ORIGIN`.

### Scripts

`npm run dev` · `npm run build` · `npm run preview` · `npm test` · `npm run typecheck` · `npm run lint`

## Structure

```
src/
├── utils/           baseURL.ts (server target) · api.ts (HTTP client) · constants.ts · countdown.ts · format.ts
├── shared/          domain contracts mirrored from server/src/shared
├── router/          route table (public /quiz/v/:token outside the auth guard) + share loader
├── store/           editor draft · active exam session (localStorage) · timer
├── modules/
│   ├── auth/        instructor login/register, session guards
│   ├── builder/     Google-Forms-style builder: examinee schema, MCQ / short / long questions,
│   │                required flags, shuffle & reveal settings
│   ├── dashboard/   quiz management, responses with manual grading, analytics, lifecycle
│   ├── examinee/    Step 1 info form → Step 2 "Start Quiz" timed exam → result
│   ├── proctor/     fullscreen lock, tab-switch/blur observers, violation handling
│   ├── leaderboard/ instructor-only rankings
│   ├── reporting/   .xlsx download
│   └── share/       share links, clipboard
├── components/      UI primitives
├── services/        storage adapters
└── types/           TypeScript contracts + editor draft types
```

## Examinee flow

1. `/quiz/v/:token` opens for anyone — resolved from `GET /api/quizzes/v/:token`, no login.
2. Step 1 collects the instructor-defined details (validated locally and on the Server). No timer, no proctoring.
3. **Start Quiz** requests fullscreen, opens the attempt (timer starts server-side; question/option
   order is shuffled per attempt when enabled) and arms proctoring; the floating timer survives refreshes.
4. Required questions must be answered before a manual submit; two violations auto-submit; submission releases all locks.
