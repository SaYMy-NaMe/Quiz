import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createTestContainer } from '@/test/db';
import { StandardGradingStrategy, NegativeMarkingStrategy } from './grading.strategy';
import { QuestionFactory } from './question.factory';

const q1 = QuestionFactory.create({ prompt: 'a', promptType: 'text', options: [{ text: '1' }, { text: '2' }], correctIndex: 0, points: 2 });
const q2 = QuestionFactory.create({ prompt: 'b', promptType: 'text', options: [{ text: '1' }, { text: '2' }], correctIndex: 1, points: 3 });

describe('grading strategies', () => {
  it('standard: full points per correct answer, ignores invalid option ids', () => {
    const r = new StandardGradingStrategy().grade([q1, q2], { [q1.id]: q1.options[0]!.id, [q2.id]: 'bogus' });
    expect(r.score).toBe(2);
    expect(r.maxScore).toBe(5);
    expect(r.breakdown[1]!.chosenOptionId).toBeNull();
  });
  it('negative marking: penalises wrong answers but not blanks, floors at 0', () => {
    const r = new NegativeMarkingStrategy(0.5).grade([q1, q2], { [q1.id]: q1.options[1]!.id });
    expect(r.score).toBe(0);
    expect(r.breakdown[0]!.earned).toBe(-1);
    expect(r.breakdown[1]!.earned).toBe(0);
  });
});

describe('submission pipeline', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let token: string;
  let questions: { id: string; options: { id: string }[] }[];
  let correctIds: string[];

  const payload = (revealAnswers: boolean) => ({
    title: 'T',
    settings: { durationSeconds: 60, revealAnswers },
    questions: [
      { prompt: 'a', options: [{ text: '1' }, { text: '2' }], correctIndex: 0, points: 2 },
      { prompt: 'b', options: [{ text: '1' }, { text: '2' }], correctIndex: 1, points: 3 },
    ],
  });

  const setup = async (revealAnswers = false) => {
    const created = await agent.post('/api/quizzes').send(payload(revealAnswers));
    correctIds = created.body.quiz.questions.map((q: { correctOptionId: string }) => q.correctOptionId);
    const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
    token = pub.body.quiz.shareToken;
    const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: {} });
    questions = started.body.questions;
    return started.body.attempt.id as string;
  };

  beforeEach(async () => {
    app = createApp(createTestContainer());
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
  });
  afterEach(() => vi.useRealTimers());

  it('grades, stores and is idempotent; hides breakdown unless revealAnswers', async () => {
    const attemptId = await setup(false);
    const answers = { [questions[0]!.id]: correctIds[0]!, [questions[1]!.id]: questions[1]!.options[0]!.id };
    const res = await request(app).post(`/api/share/${token}/attempts/${attemptId}/submit`).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.receipt.score).toBe(2);
    expect(res.body.receipt.maxScore).toBe(5);
    expect(res.body.receipt.reason).toBe('manual');
    expect(res.body.receipt.breakdown).toBeUndefined();

    const again = await request(app).post(`/api/share/${token}/attempts/${attemptId}/submit`).send({ answers: {} });
    expect(again.body.receipt.submissionId).toBe(res.body.receipt.submissionId);
    expect(again.body.receipt.score).toBe(2);

    const result = await request(app).get(`/api/share/${token}/attempts/${attemptId}/result`);
    expect(result.body.receipt.score).toBe(2);
  });

  it('returns a breakdown when answers are revealed', async () => {
    const attemptId = await setup(true);
    const res = await request(app).post(`/api/share/${token}/attempts/${attemptId}/submit`).send({ answers: {} });
    expect(res.body.receipt.breakdown).toHaveLength(2);
    expect(res.body.receipt.breakdown[0].correctOptionId).toBe(correctIds[0]);
  });

  it('forces reason=timeout when the server deadline has passed', async () => {
    const attemptId = await setup(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    const res = await request(app).post(`/api/share/${token}/attempts/${attemptId}/submit`).send({ answers: {}, reason: 'manual' });
    expect(res.body.receipt.reason).toBe('timeout');
    expect(res.body.receipt.durationSeconds).toBe(60);
  });
});
