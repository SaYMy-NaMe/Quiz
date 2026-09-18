/**
 * End-to-end integration across every module: auth → authoring → examinee schema →
 * share link → onboarding → timed attempt → proctoring → submission → leaderboard →
 * analytics → Excel export → lifecycle → deletion. Runs against an in-memory SQLite DB.
 */
import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';

const container = createContainer({ db: openDatabase(':memory:') });
const app = createApp(container);
const instructor = request.agent(app);
const anon = request(app);

interface Ctx {
  quizId: string;
  token: string;
  questionIds: string[];
  correct: Record<string, string>;
  wrong: Record<string, string>;
  submissionIds: Record<string, string>;
}
const ctx: Ctx = { quizId: '', token: '', questionIds: [], correct: {}, wrong: {}, submissionIds: {} };
let invites: { email: string; token: string }[] = [];

const quizPayload = {
  title: 'Integration Quiz',
  description: 'Full lifecycle',
  settings: { durationSeconds: 300, revealAnswers: true, accessMode: 'restricted' },
  examineeFields: [
    { fieldId: 'name', label: 'Full Name', type: 'text', required: true },
    { fieldId: 'email', label: 'Email', type: 'email', required: true },
    { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] },
    { fieldId: 'age', label: 'Age', type: 'number', required: false },
  ],
  questions: [
    { prompt: 'Q1', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }], correctIndex: 0, points: 3 },
    { prompt: 'Q2', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 1, points: 2 },
    { prompt: '', promptType: 'image', imageUrl: '/uploads/x.png', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }, { text: 'e' }, { text: 'f' }], correctIndex: 5, points: 5 },
  ],
};

describe('platform integration', () => {
  beforeAll(async () => {
    const reg = await instructor.post('/api/auth/register').send({ name: 'Prof', email: 'prof@uni.edu', password: 'correct-horse-battery' });
    expect(reg.status).toBe(201);
  });
  afterAll(() => vi.useRealTimers());

  it('authors a quiz with 2–6 option MCQs, image prompt and examinee schema', async () => {
    const res = await instructor.post('/api/quizzes').send(quizPayload);
    expect(res.status).toBe(201);
    const quiz = res.body.quiz;
    ctx.quizId = quiz.id;
    ctx.questionIds = quiz.questions.map((q: { id: string }) => q.id);
    for (const q of quiz.questions as { id: string; correctOptionId: string; options: { id: string }[] }[]) {
      ctx.correct[q.id] = q.correctOptionId;
      ctx.wrong[q.id] = q.options.find((o) => o.id !== q.correctOptionId)!.id;
    }
    expect(quiz.status).toBe('draft');
    expect(quiz.shareToken).toBeNull();
    expect(quiz.questions[2].options).toHaveLength(6);
    expect(quiz.examineeFields).toHaveLength(4);
  });

  it('rejects a share link before publishing and publishes with a 132-bit token', async () => {
    expect((await anon.get('/api/share/abcdefghijklmnopqrstuv')).status).toBe(404);
    const pub = await instructor.post(`/api/quizzes/${ctx.quizId}/publish`);
    expect(pub.status).toBe(200);
    ctx.token = pub.body.quiz.shareToken;
    expect(ctx.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('enforces restricted access via invites and locks the email', async () => {
    expect((await anon.get(`/api/share/${ctx.token}`)).status).toBe(404);
    const inv = await instructor.post(`/api/quizzes/${ctx.quizId}/invites`).send({ emails: ['ann@uni.edu', 'bob@uni.edu', 'cat@uni.edu'] });
    expect(inv.body.invites).toHaveLength(3);
    invites = inv.body.invites;
    const res = await anon.get(`/api/share/${ctx.token}?invite=${inv.body.invites[0].token}`);
    expect(res.status).toBe(200);
    expect(res.body.quiz.lockedEmail).toBe('ann@uni.edu');
    expect(res.body.quiz.questionCount).toBe(3);
    expect(res.body.quiz.questions).toBeUndefined();
  });

  const runExaminee = async (
    invite: { email: string; token: string },
    name: string,
    answerPlan: ('correct' | 'wrong' | 'blank')[],
    opts: { violations?: number; reason?: 'manual' | 'timeout' | 'violation'; delayMs?: number } = {},
  ) => {
    const start = await anon.post(`/api/share/${ctx.token}/attempts`).send({ inviteToken: invite.token, examinee: { name, email: 'spoof@x.io', section: 'A', age: '21' } });
    expect(start.status).toBe(201);
    expect(start.body.attempt.examinee.email).toBe(invite.email);
    expect(start.body.attempt.examinee.age).toBe(21);
    const attemptId = start.body.attempt.id as string;
    for (let i = 0; i < (opts.violations ?? 0); i++) {
      const v = await anon.post(`/api/share/${ctx.token}/attempts/${attemptId}/violations`).send({ inviteToken: invite.token, kind: i % 2 ? 'blur' : 'visibility' });
      expect(v.status).toBe(200);
    }
    const answers: Record<string, string> = {};
    ctx.questionIds.forEach((qid, i) => {
      const plan = answerPlan[i];
      if (plan === 'correct') answers[qid] = ctx.correct[qid]!;
      if (plan === 'wrong') answers[qid] = ctx.wrong[qid]!;
    });
    if (opts.delayMs) {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + opts.delayMs);
    }
    const sub = await anon.post(`/api/share/${ctx.token}/attempts/${attemptId}/submit`).send({ inviteToken: invite.token, answers, reason: opts.reason ?? 'manual' });
    vi.useRealTimers();
    expect(sub.status).toBe(200);
    ctx.submissionIds[name] = sub.body.receipt.submissionId;
    return sub.body.receipt as { score: number; maxScore: number; reason: string; durationSeconds: number; breakdown?: unknown[] };
  };

  it('runs three examinees through onboarding, proctoring and submission', async () => {
    const [ann, bob, cat] = invites;
    const r1 = await runExaminee(ann!, 'Ann', ['correct', 'correct', 'correct'], { delayMs: 20_000 });
    expect(r1.score).toBe(10);
    expect(r1.breakdown).toHaveLength(3);
    const r2 = await runExaminee(bob!, 'Bob', ['correct', 'correct', 'correct'], { delayMs: 5_000 });
    expect(r2.score).toBe(10);
    const r3 = await runExaminee(cat!, 'Cat', ['correct', 'wrong', 'blank'], { violations: 2, reason: 'violation' });
    expect(r3.score).toBe(3);
    expect(r3.reason).toBe('violation');
  });

  it('ranks Score desc → Duration asc → Timestamp asc for the instructor only', async () => {
    const mine = await instructor.get(`/api/quizzes/${ctx.quizId}/leaderboard`);
    const names = mine.body.leaderboard.entries.map((e: { displayName: string }) => e.displayName);
    expect(names).toEqual(['Bob', 'Ann', 'Cat']); // Bob and Ann tie on score; Bob was faster
    expect(mine.body.leaderboard.entries[0].examinee.email).toBe('bob@uni.edu');

    expect((await anon.get(`/api/share/${ctx.token}/leaderboard?invite=${invites[0]!.token}`)).status).toBe(404);
  });

  it('reports analytics with per-question distributions', async () => {
    const res = await instructor.get(`/api/quizzes/${ctx.quizId}/analytics`);
    const a = res.body.analytics;
    expect(a.submissionCount).toBe(3);
    expect(a.maxScore).toBe(10);
    expect(a.reasons).toEqual({ manual: 2, timeout: 0, violation: 1 });
    expect(a.totalViolations).toBe(2);
    expect(a.questions[1].correct).toBe(2);
    expect(a.questions[2].answered).toBe(2);
  });

  it('exports an xlsx whose headers are the dynamic examinee fields', async () => {
    const res = await instructor.get(`/api/quizzes/${ctx.quizId}/export/xlsx`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.getWorksheet('Submissions')!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers.slice(0, 6)).toEqual(['Rank', 'Full Name', 'Email', 'Section', 'Age', 'Score']);
    expect(sheet.rowCount).toBe(4);
    expect((sheet.getRow(2).values as unknown[])[2]).toBe('Bob');
    expect((sheet.getRow(4).values as unknown[])[headers.indexOf('Violations') + 1]).toBe(2);
    expect(wb.getWorksheet('Answers')!.rowCount).toBe(1 + 3 * 3);
  });

  it('walks the lifecycle state machine and blocks editing while published', async () => {
    expect((await instructor.put(`/api/quizzes/${ctx.quizId}`).send(quizPayload)).status).toBe(409);
    expect((await instructor.post(`/api/quizzes/${ctx.quizId}/close`)).body.quiz.status).toBe('closed');
    expect((await anon.get(`/api/share/${ctx.token}?invite=${invites[0]!.token}`)).status).toBe(404);
    expect((await instructor.post(`/api/quizzes/${ctx.quizId}/reopen`)).body.quiz.status).toBe('published');
    expect((await instructor.post(`/api/quizzes/${ctx.quizId}/unpublish`)).body.quiz.status).toBe('draft');
    const edited = await instructor.put(`/api/quizzes/${ctx.quizId}`).send({ ...quizPayload, title: 'Edited' });
    expect(edited.status).toBe(200);
    expect(edited.body.quiz.title).toBe('Edited');
    // Re-publishing keeps the same token so previously shared links keep working.
    expect((await instructor.post(`/api/quizzes/${ctx.quizId}/publish`)).body.quiz.shareToken).toBe(ctx.token);
  });

  it('deletes the quiz and cascades attempts, submissions and invites', async () => {
    expect((await instructor.delete(`/api/quizzes/${ctx.quizId}`)).status).toBe(204);
    expect((await anon.get(`/api/share/${ctx.token}?invite=${invites[0]!.token}`)).status).toBe(404);
    expect((await instructor.get(`/api/quizzes/${ctx.quizId}/leaderboard`)).status).toBe(404);
    const count = container.db.prepare('SELECT COUNT(*) AS n FROM submissions').get() as { n: number };
    expect(count.n).toBe(0);
    const invitesLeft = container.db.prepare('SELECT COUNT(*) AS n FROM invites').get() as { n: number };
    expect(invitesLeft.n).toBe(0);
  });

  it('logs out and loses access', async () => {
    await instructor.post('/api/auth/logout');
    expect((await instructor.get('/api/quizzes')).status).toBe(401);
  });
});
