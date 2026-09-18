# Quiz Platform

Production-grade online quiz platform: strict timed proctoring, dynamic leaderboards,
automated grading, dynamic examinee metadata collection, Excel reporting and
link-exclusive quiz distribution.

## Architecture

Modular monolith with a clean frontend / backend separation:

```
client/   Vite + React + TypeScript (feature-based modules under src/modules)
server/   Express + TypeScript + SQLite (feature-based modules under src/modules)
shared/   Domain contracts shared by both sides (types, constants)
```

Design patterns applied:

| Pattern   | Where                                                                 |
|-----------|-----------------------------------------------------------------------|
| Factory   | Question / Option / SchemaField creation                              |
| Builder   | Dynamic examinee Zod schema synthesis (composite of field validators) |
| Strategy  | Grading engine, link access validation, leaderboard tie-breaking      |
| Observer  | Timer ticks, proctor violations, submission events                    |
| State     | Quiz lifecycle (Draft → Published → Closed), Attempt (InProgress → Submitted) |
| DI        | Service container wiring repositories into services and routers      |

## Getting started

```bash
npm install
cp server/.env.example server/.env
npm run dev          # server on :4000, client on :5173 (proxied)
npm test
```
