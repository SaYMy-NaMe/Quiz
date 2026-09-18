import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createTestContainer } from '@/test/db';

describe('background grading engine', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    app = createApp(createTestContainer());
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
  });

  it('never exposes the answer key to examinees before submission', async () => {
    const created = await agent.post('/api/quizzes').send({
      title: 'K', settings: { revealAnswers: false },
      questions: [{ prompt: 'a', options: [{ text: '1' }, { text: '2' }], correctIndex: 1 }],
    });
    const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
    const token = pub.body.quiz.shareToken as string;
    const share = await request(app).get(`/api/share/${token}`);
    const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: {} });
    const resumed = await request(app).get(`/api/share/${token}/attempts/${started.body.attempt.id}`);
    const submitted = await request(app).post(`/api/share/${token}/attempts/${started.body.attempt.id}/submit`).send({ answers: {} });
    for (const body of [share.body, started.body, resumed.body, submitted.body]) {
      expect(JSON.stringify(body)).not.toMatch(/correctOptionId|correctIndex/);
    }
  });

  it('regrades stored submissions after the answer key is corrected', async () => {
    const created = await agent.post('/api/quizzes').send({
      title: 'G',
      questions: [{ prompt: 'a', options: [{ id: 'o1', text: '1' }, { id: 'o2', text: '2' }], correctIndex: 0, points: 4 }],
    });
    const id = created.body.quiz.id as string;
    const qid = created.body.quiz.questions[0].id as string;
    const pub = await agent.post(`/api/quizzes/${id}/publish`);
    const token = pub.body.quiz.shareToken as string;
    const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: {} });
    const sub = await request(app).post(`/api/share/${token}/attempts/${started.body.attempt.id}/submit`).send({ answers: { [qid]: 'o2' } });
    expect(sub.body.receipt.score).toBe(0);

    // Instructor realises option 2 was the right answer.
    await agent.post(`/api/quizzes/${id}/unpublish`);
    await agent.put(`/api/quizzes/${id}`).send({
      title: 'G',
      questions: [{ id: qid, prompt: 'a', options: [{ id: 'o1', text: '1' }, { id: 'o2', text: '2' }], correctIndex: 1, points: 4 }],
    });
    await agent.post(`/api/quizzes/${id}/publish`);
    const regrade = await agent.post(`/api/quizzes/${id}/regrade`);
    expect(regrade.body.result).toEqual({ quizId: id, regraded: 1, changed: 1 });

    const board = await agent.get(`/api/quizzes/${id}/leaderboard`);
    expect(board.body.leaderboard.entries[0].score).toBe(4);
    const again = await agent.post(`/api/quizzes/${id}/regrade`);
    expect(again.body.result.changed).toBe(0);
  });
});
