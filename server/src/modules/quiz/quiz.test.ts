import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';
import { QuestionFactory } from './question.factory';
import { stateOf } from './quiz.state';
import type { Quiz } from '@shared';

const baseQuiz = (): Quiz => ({
  id: 'q1',
  ownerId: 'o1',
  title: 'T',
  description: '',
  status: 'draft',
  shareToken: null,
  durationSeconds: 60,
  revealAnswers: false,
  revealScores: true,
  accessMode: 'public',
  examineeFields: [],
  questions: [QuestionFactory.create({ prompt: 'p', promptType: 'text', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 })],
  createdAt: '',
  updatedAt: '',
});

describe('QuestionFactory', () => {
  it('assigns ids and resolves correct answer by index', () => {
    const q = QuestionFactory.create({ prompt: 'x', promptType: 'text', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 1 });
    expect(q.id).toBeTruthy();
    expect(q.correctOptionId).toBe(q.options[1]!.id);
    expect(q.points).toBe(1);
  });
  it('rejects too few / too many options', () => {
    expect(() => QuestionFactory.create({ prompt: 'x', promptType: 'text', options: [{ text: 'a' }], correctIndex: 0 })).toThrow();
    const seven = Array.from({ length: 7 }, (_, i) => ({ text: `o${i}` }));
    expect(() => QuestionFactory.create({ prompt: 'x', promptType: 'text', options: seven, correctIndex: 0 })).toThrow();
  });
  it('requires an image for image prompts', () => {
    expect(() => QuestionFactory.create({ prompt: '', promptType: 'image', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 })).toThrow();
  });
});

describe('Quiz state machine', () => {
  it('draft -> published issues a token; published -> closed -> published', () => {
    const published = stateOf(baseQuiz()).publish(baseQuiz(), () => 'tok');
    expect(published.status).toBe('published');
    expect(published.shareToken).toBe('tok');
    const closed = stateOf(published).close(published);
    expect(closed.status).toBe('closed');
    expect(stateOf(closed).reopen(closed).status).toBe('published');
    expect(stateOf(published).unpublish(published).status).toBe('draft');
  });
  it('rejects invalid transitions and empty publish', () => {
    expect(() => stateOf(baseQuiz()).close(baseQuiz())).toThrow(/Cannot close/);
    const empty = { ...baseQuiz(), questions: [] };
    expect(() => stateOf(empty).publish(empty, () => 't')).toThrow(/at least one/);
  });
});

describe('quiz API', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    app = createApp(createContainer({ db: openDatabase(':memory:') }));
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
  });

  const payload = {
    title: 'Algebra',
    description: 'd',
    settings: { durationSeconds: 120 },
    questions: [{ prompt: '1+1', options: [{ text: '2' }, { text: '3' }, { text: '4' }], correctIndex: 0, points: 2 }],
  };

  it('creates, reads, updates, publishes and deletes a quiz', async () => {
    const created = await agent.post('/api/quizzes').send(payload);
    expect(created.status).toBe(201);
    const id = created.body.quiz.id as string;
    expect(created.body.quiz.questions[0].correctOptionId).toBe(created.body.quiz.questions[0].options[0].id);

    const updated = await agent.put(`/api/quizzes/${id}`).send({ ...payload, title: 'Algebra II' });
    expect(updated.body.quiz.title).toBe('Algebra II');

    const published = await agent.post(`/api/quizzes/${id}/publish`);
    expect(published.body.quiz.status).toBe('published');
    expect(published.body.quiz.shareToken).toHaveLength(22);

    const locked = await agent.put(`/api/quizzes/${id}`).send(payload);
    expect(locked.status).toBe(409);

    const list = await agent.get('/api/quizzes');
    expect(list.body.quizzes).toHaveLength(1);
    expect(list.body.quizzes[0].maxScore).toBe(2);

    expect((await agent.delete(`/api/quizzes/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/quizzes/${id}`)).status).toBe(404);
  });

  it('hides other instructors quizzes behind 404', async () => {
    const created = await agent.post('/api/quizzes').send(payload);
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ name: 'B', email: 'b@x.io', password: 'password123' });
    expect((await other.get(`/api/quizzes/${created.body.quiz.id}`)).status).toBe(404);
    expect((await request(app).get('/api/quizzes')).status).toBe(401);
  });

  it('validates option count', async () => {
    const res = await agent.post('/api/quizzes').send({ ...payload, questions: [{ prompt: 'x', options: [{ text: 'a' }], correctIndex: 0 }] });
    expect(res.status).toBe(400);
  });
});

describe('choice images and reveal toggles', () => {
  it('accepts image-only options and rejects empty ones', () => {
    const q = QuestionFactory.create({ prompt: 'x', promptType: 'text', options: [{ text: '', imageUrl: '/uploads/a.png' }, { text: 'b' }], correctIndex: 0 });
    expect(q.options[0]).toEqual({ id: expect.any(String), text: '', imageUrl: '/uploads/a.png' });
    expect(() => QuestionFactory.create({ prompt: 'x', promptType: 'text', options: [{ text: '' }, { text: 'b' }], correctIndex: 0 })).toThrow(/text or an image/);
  });

  it('hides the score from the receipt when revealScores is off (unless the key is revealed)', async () => {
    const app = createApp(createContainer({ db: openDatabase(':memory:') }));
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const run = async (settings: Record<string, boolean>) => {
      const created = await agent.post('/api/quizzes').send({
        title: 'R', settings, questions: [{ prompt: 'a', options: [{ text: '1' }, { text: '2' }], correctIndex: 0 }],
      });
      const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
      const started = await request(app).post(`/api/share/${pub.body.quiz.shareToken}/attempts`).send({ examinee: {} });
      const sub = await request(app).post(`/api/share/${pub.body.quiz.shareToken}/attempts/${started.body.attempt.id}/submit`).send({ answers: {} });
      return sub.body.receipt as { score: number | null; maxScore: number | null; breakdown?: unknown[] };
    };
    const hidden = await run({ revealScores: false, revealAnswers: false });
    expect(hidden.score).toBeNull();
    expect(hidden.maxScore).toBeNull();
    expect(hidden.breakdown).toBeUndefined();
    const shown = await run({ revealScores: true, revealAnswers: false });
    expect(shown.score).toBe(0);
    const keyed = await run({ revealScores: false, revealAnswers: true });
    expect(keyed.score).toBe(0);
    expect(keyed.breakdown).toHaveLength(1);
  });
});
