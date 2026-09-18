# Repository Audit — SaYMy-NaMe/Quiz

Audited at `main@191ec89` against the "Google Forms Clone for Proctored Exams" specification.

## Current state (what already exists)

| Area | Status | Notes |
|------|--------|-------|
| Monorepo (client / server / shared), strict TS, path aliases | ✅ | npm workspaces, `node:sqlite`, vitest, type-checked ESLint |
| Instructor auth (bcrypt, server-side sessions, httpOnly cookie, guards) | ✅ | Examinees never authenticate |
| Dynamic examinee schema builder + shared Zod schema synthesis | ✅ | Builder/Composite pattern, text / number / email / select |
| MCQ builder, 2–6 options, text/image **question** prompts, answer key | ⚠️ | **Choices** cannot carry images (spec: "text or image prompts for questions and choices") |
| Reveal toggle | ⚠️ | Only answer-key reveal exists; spec requires **score** *and* answer-key toggles |
| Tokenized public links `/quiz/v/:token`, uniform 404, CSPRNG tokens | ✅ | Restricted/invite mode is an extension beyond spec; kept |
| Two-step exam flow | ⚠️ | Step 1 submit *immediately* opens the timed attempt; spec wants an explicit **"Start Quiz"** action that starts timer + proctoring |
| Timer (server deadline, drift-proof, localStorage recovery) | ✅ | Presented in a sticky bar; spec asks for an **omnipresent floating timer** |
| Proctoring (fullscreen, visibility, blur, shortcuts, context menu, 2-strike auto-submit, unlock on submit) | ✅ | Armed only in Step 2 |
| Grading engine (Strategy), answer keys stripped from every examinee payload | ✅ | `correctOptionId` never leaves the server before submission |
| Leaderboard | ❌ | Public examinee leaderboard + visibility toggle exist; spec: **instructor-only, hidden from examinees** |
| Excel export with dynamic headers + ISO-8601 timestamps | ✅ | Streamed via exceljs |
| Dashboard (CRUD, delete, link copy, analytics) | ⚠️ | No per-response viewer (spec: "response viewing") |
| Folder layout | ⚠️ | Editor lives under `modules/quiz`; spec mandates `modules/builder`, top-level `store/`, `types/`, `utils/` |
| Stray `* 2.*` duplicate files (untracked) | ❌ | Stale snapshots; removed |

## Realignment plan (all stages completed — see git history `setup/repo-audit` → `refactor/polish`)

1. **Layout** (this stage): move the editor into `modules/builder`, global stores into `src/store`,
   contracts into `src/types`, the countdown observable into `src/utils`. `modules/quiz` is dissolved.
   `router/`, `services/`, `config/` and `assets/` stay as infrastructure folders.
2. **Auth**: centralised 401 handling so an expired instructor session drops to `/login`.
3. **Builder**: Google-Forms card UI, choice images, `revealScores` + `revealAnswers` toggles.
4. **Share**: token rotation for leaked links.
5. **Examinee**: Step 1 collects and validates metadata only; Step 2 shows a "Start Quiz" gate that
   opens the attempt, starts the timer, requests fullscreen and arms proctoring; floating timer.
6. **Grading**: receipts honour `revealScores`; answers still never leave the server early.
7. **Leaderboard**: remove every examinee-facing route/page/toggle; instructor dashboard only.
8. **Reporting**: add a per-question summary sheet.
9. **Dashboard**: response viewer with per-submission answer detail.
10. **Polish**: lint / typecheck / tests / docs.
