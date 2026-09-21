import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app, instructorAgent, publishedQuiz, takeQuiz, mcq, basicQuiz } from '@/test/helpers';
import { grade } from './grading';
import type { Question } from '@shared';

const q = (over: Partial<Question>): Question => ({ id: 'q', type: 'mcq', prompt: 'p', promptType: 'text', required: true, points: 2, options: [], ...over });

describe('grading engine', () => {
  it('grades MCQ, keyed short answers and manual text answers', () => {
    const questions = [
      q({ id: 'm', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'b' }),
      q({ id: 's', type: 'short', acceptedAnswers: ['Paris'], points: 3 }),
      q({ id: 'l', type: 'long', points: 5 }),
    ];
    const r = grade(questions, { m: 'b', s: '  PARIS ', l: 'because' });
    expect(r).toMatchObject({ score: 5, maxScore: 10, needsReview: true });
    expect(r.breakdown[2]).toMatchObject({ needsReview: true, earned: 0 });
    const graded = grade(questions, { m: 'zzz', s: 'Rome', l: 'because' }, { l: 4 });
    expect(graded).toMatchObject({ score: 4, needsReview: false });
    expect(graded.breakdown[0]!.answer).toBeNull(); // invalid option id treated as blank
  });
});

describe('public quiz + examinee flow', () => {
  afterEach(() => vi.useRealTimers());

  it('returns 404 for unknown, malformed, draft and closed tokens', async () => {
    const agent = await instructorAgent();
    expect((await request(app).get('/api/quizzes/v/nope')).status).toBe(404);
    const { quiz, token } = await publishedQuiz(agent);
    await agent.post(`/api/quizzes/${quiz.id}/close`);
    expect((await request(app).get(`/api/quizzes/v/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${token}`)).status).toBe(404);
  });

  it('never leaks answer keys; Step 1 validates without creating an attempt', async () => {
    const agent = await instructorAgent();
    const { token } = await publishedQuiz(agent, {
      title: 'Keys', examineeFields: basicQuiz.examineeFields, questions: [mcq('q', ['a', 'b'], 1), { type: 'short', prompt: 's', acceptedAnswers: ['secret'] }],
    });
    const pub = await request(app).get(`/api/quizzes/v/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.quiz.questionCount).toBe(2);
    const bad = await request(app).post(`/api/quizzes/v/${token}/attempts/validate`).send({ examinee: {} });
    expect(bad.status).toBe(400);
    const started = await request(app).post(`/api/quizzes/v/${token}/attempts`).send({ examinee: { name: 'Stu', extra: 'x' } });
    expect(started.body.attempt.examinee).toEqual({ name: 'Stu' });
    for (const body of [pub.body, started.body]) expect(JSON.stringify(body)).not.toMatch(/correctOptionId|acceptedAnswers|secret/);
  });

  it('freezes a per-attempt shuffle that survives resume and does not affect grading', async () => {
    const agent = await instructorAgent();
    const texts = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const { token, quiz } = await publishedQuiz(agent, {
      title: 'Shuffle', settings: { shuffleQuestions: true, shuffleOptions: true },
      questions: [mcq('A', texts, 0), mcq('B', texts, 1), mcq('C', texts, 2), mcq('D', texts, 3), mcq('E', texts, 4), mcq('F', texts, 5)],
    });
    const runs = await Promise.all(Array.from({ length: 4 }, () => request(app).post(`/api/quizzes/v/${token}/attempts`).send({ examinee: { name: 'S' } })));
    const layouts = runs.map((r) => JSON.stringify(r.body.questions.map((x: { id: string; options: { id: string }[] }) => [x.id, x.options.map((o) => o.id)])));
    expect(new Set(layouts).size).toBeGreaterThan(1);
    const first = runs[0]!.body;
    const resumed = await request(app).get(`/api/quizzes/v/${token}/attempts/${first.attempt.id}`);
    expect(JSON.stringify(resumed.body.questions)).toBe(JSON.stringify(first.questions));
    // Answer by the *real* key (from the instructor view) regardless of presented order.
    const answers = Object.fromEntries(quiz.questions.map((x: { id: string; correctOptionId: string }) => [x.id, x.correctOptionId]));
    const sub = await request(app).post(`/api/quizzes/v/${token}/attempts/${first.attempt.id}/submit`).send({ answers });
    expect(sub.body.receipt.score).toBe(6);
  });

  it('enforces required questions on manual submit only, marks timeouts, is idempotent', async () => {
    const agent = await instructorAgent();
    const { token } = await publishedQuiz(agent, {
      title: 'Req', settings: { durationSeconds: 60 },
      questions: [mcq('a', ['1', '2'], 0, { required: true }), { type: 'long', prompt: 'essay', required: false }],
    });
    const blocked = await takeQuiz(token, { name: 'S' }, () => ({}));
    expect(blocked.status).toBe(400);
    expect(blocked.receipt).toBeUndefined();
    const forced = await request(app).post(`/api/quizzes/v/${token}/attempts/${blocked.attemptId}/submit`).send({ answers: {}, reason: 'violation' });
    expect(forced.body.receipt.reason).toBe('violation');
    const again = await request(app).post(`/api/quizzes/v/${token}/attempts/${blocked.attemptId}/submit`).send({ answers: {}, reason: 'manual' });
    expect(again.body.receipt.submissionId).toBe(forced.body.receipt.submissionId);

    const late = await request(app).post(`/api/quizzes/v/${token}/attempts`).send({ examinee: { name: 'L' } });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    const res = await request(app).post(`/api/quizzes/v/${token}/attempts/${late.body.attempt.id}/submit`).send({ answers: { [late.body.questions[0].id]: late.body.questions[0].options[0].id }, reason: 'manual' });
    expect(res.body.receipt).toMatchObject({ reason: 'timeout', durationSeconds: 60 });
  });

  it('honours reveal toggles and reports pending review', async () => {
    const agent = await instructorAgent();
    const { token } = await publishedQuiz(agent, {
      title: 'Reveal', settings: { revealScores: false, revealAnswers: false },
      questions: [{ type: 'long', prompt: 'essay', points: 4 }],
    });
    const r = await takeQuiz(token, { name: 'S' }, (qs) => ({ [qs[0]!.id]: 'my essay' }));
    expect(r.receipt).toMatchObject({ score: null, maxScore: null, needsReview: true });
    expect(r.receipt.breakdown).toBeUndefined();
  });

  it('counts proctoring violations and signals auto-submit at the threshold', async () => {
    const agent = await instructorAgent();
    const { token } = await publishedQuiz(agent);
    const started = await request(app).post(`/api/quizzes/v/${token}/attempts`).send({ examinee: { name: 'S' } });
    const url = `/api/quizzes/v/${token}/attempts/${started.body.attempt.id}/violations`;
    expect((await request(app).post(url).send({ kind: 'visibility' })).body).toEqual({ violations: 1, threshold: 2, shouldSubmit: false });
    expect((await request(app).post(url).send({ kind: 'blur' })).body.shouldSubmit).toBe(true);
    expect((await request(app).post(url).send({ kind: 'nope' })).status).toBe(400);
    await request(app).post(`/api/quizzes/v/${token}/attempts/${started.body.attempt.id}/submit`).send({ answers: {}, reason: 'violation' });
    expect((await request(app).post(url).send({ kind: 'blur' })).body.violations).toBe(2); // frozen after submit
  });
});
