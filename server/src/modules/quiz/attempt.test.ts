import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';

const payload = {
  title: 'Shared',
  settings: { durationSeconds: 120 },
  questions: [{ prompt: '1+1', options: [{ text: '2' }, { text: '3' }], correctIndex: 0 }],
  examineeFields: [
    { fieldId: 'name', label: 'Name', type: 'text', required: true },
    { fieldId: 'email', label: 'Email', type: 'email', required: true },
    { fieldId: 'age', label: 'Age', type: 'number', required: false },
  ],
};

describe('attempt start / resume', () => {
  let app: ReturnType<typeof createApp>;
  let container: ReturnType<typeof createContainer>;
  let agent: ReturnType<typeof request.agent>;
  let token: string;
  let quizId: string;

  const setup = async (settings: Record<string, unknown> = {}) => {
    const created = await agent.post('/api/quizzes').send({ ...payload, settings: { ...payload.settings, ...settings } });
    quizId = created.body.quiz.id;
    const pub = await agent.post(`/api/quizzes/${quizId}/publish`);
    token = pub.body.quiz.shareToken;
  };

  beforeEach(async () => {
    container = createContainer({ db: openDatabase(':memory:') });
    app = createApp(container);
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
  });

  it('validates the dynamic examinee schema before opening an attempt', async () => {
    await setup();
    const bad = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: { name: '', email: 'x' } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.fieldErrors.name).toMatch(/required/);
    expect(bad.body.error.details.fieldErrors.email).toMatch(/valid email/);

    const ok = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: { name: 'Stu', email: 'S@X.io', age: '20', extra: 'nope' } });
    expect(ok.status).toBe(201);
    expect(ok.body.attempt.examinee).toEqual({ name: 'Stu', email: 's@x.io', age: 20 });
    expect(ok.body.attempt.status).toBe('in_progress');
    expect(new Date(ok.body.attempt.expiresAt).getTime() - new Date(ok.body.attempt.startedAt).getTime()).toBe(120_000);
    expect(ok.body.questions).toHaveLength(1);
    expect(JSON.stringify(ok.body.questions)).not.toContain('correctOptionId');

    const resumed = await request(app).get(`/api/share/${token}/attempts/${ok.body.attempt.id}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.attempt.id).toBe(ok.body.attempt.id);
    expect((await request(app).get(`/api/share/${token}/attempts/unknown`)).status).toBe(404);
  });

  it('validates step-1 metadata without creating an attempt', async () => {
    await setup();
    const bad = await request(app).post(`/api/share/${token}/attempts/validate`).send({ examinee: { name: '' } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.fieldErrors.name).toMatch(/required/);
    const ok = await request(app).post(`/api/share/${token}/attempts/validate`).send({ examinee: { name: 'Stu', email: 'S@X.io', junk: 1 } });
    expect(ok.status).toBe(200);
    expect(ok.body.examinee).toEqual({ name: 'Stu', email: 's@x.io' });
    const count = container.db.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('pins the email to the invite on restricted quizzes', async () => {
    await setup({ accessMode: 'restricted' });
    const inv = await agent.post(`/api/quizzes/${quizId}/invites`).send({ emails: ['locked@school.edu'] });
    const inviteToken = inv.body.invites[0].token as string;
    expect((await request(app).post(`/api/share/${token}/attempts`).send({ examinee: { name: 'S', email: 'a@b.c' } })).status).toBe(404);
    const ok = await request(app).post(`/api/share/${token}/attempts`).send({ inviteToken, examinee: { name: 'S', email: 'spoof@evil.io' } });
    expect(ok.status).toBe(201);
    expect(ok.body.attempt.examinee.email).toBe('locked@school.edu');
  });
});
