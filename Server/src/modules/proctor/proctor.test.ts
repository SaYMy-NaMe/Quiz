import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createTestContainer } from '@/test/db';

describe('proctoring violations', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;
  let attemptId: string;
  let container: ReturnType<typeof createTestContainer>;

  beforeEach(async () => {
    container = createTestContainer();
    app = createApp(container);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const created = await agent.post('/api/quizzes').send({
      title: 'T',
      questions: [{ prompt: 'a', options: [{ text: '1' }, { text: '2' }], correctIndex: 0 }],
    });
    const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
    token = pub.body.quiz.shareToken;
    const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: {} });
    attemptId = started.body.attempt.id;
  });

  it('counts violations, signals auto-submit at the threshold and records them on the submission', async () => {
    const seen: number[] = [];
    container.events.on('attempt:violation', (e) => seen.push(e.violations));

    const first = await request(app).post(`/api/share/${token}/attempts/${attemptId}/violations`).send({ kind: 'visibility' });
    expect(first.body).toEqual({ violations: 1, threshold: 2, shouldSubmit: false });
    const second = await request(app).post(`/api/share/${token}/attempts/${attemptId}/violations`).send({ kind: 'blur' });
    expect(second.body.shouldSubmit).toBe(true);
    expect(seen).toEqual([1, 2]);

    const submitted = await request(app).post(`/api/share/${token}/attempts/${attemptId}/submit`).send({ answers: {}, reason: 'violation' });
    expect(submitted.body.receipt.reason).toBe('violation');
    const resumed = await request(app).get(`/api/share/${token}/attempts/${attemptId}`);
    expect(resumed.body.attempt.violations).toBe(2);

    // After submission further reports are ignored (no increment).
    const late = await request(app).post(`/api/share/${token}/attempts/${attemptId}/violations`).send({ kind: 'blur' });
    expect(late.body.violations).toBe(2);
    expect(late.body.shouldSubmit).toBe(false);
  });

  it('rejects unknown kinds and attempts', async () => {
    expect((await request(app).post(`/api/share/${token}/attempts/${attemptId}/violations`).send({ kind: 'nope' })).status).toBe(400);
    expect((await request(app).post(`/api/share/${token}/attempts/xyz/violations`).send({ kind: 'blur' })).status).toBe(404);
  });
});
