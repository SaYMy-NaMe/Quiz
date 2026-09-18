import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createTestContainer } from '@/test/db';
import { secureToken, TOKEN_PATTERN } from './token.service';

const payload = {
  title: 'Shared',
  questions: [{ prompt: '1+1', options: [{ text: '2' }, { text: '3' }], correctIndex: 0 }],
  examineeFields: [{ fieldId: 'name', label: 'Name', type: 'text', required: true }],
};

describe('secureToken', () => {
  it('produces well-formed, unique tokens', () => {
    const a = secureToken(22);
    const b = secureToken(22);
    expect(a).toHaveLength(22);
    expect(TOKEN_PATTERN.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('share links', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    app = createApp(createTestContainer());
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
  });

  it('returns 404 for unknown, malformed and draft tokens', async () => {
    expect((await request(app).get('/api/share/nope')).status).toBe(404);
    expect((await request(app).get(`/api/share/${secureToken(22)}`)).status).toBe(404);
    const created = await agent.post('/api/quizzes').send(payload);
    // Draft quizzes have no token; publish then unpublish leaves the token but blocks access.
    const id = created.body.quiz.id as string;
    const pub = await agent.post(`/api/quizzes/${id}/publish`);
    const token = pub.body.quiz.shareToken as string;
    await agent.post(`/api/quizzes/${id}/unpublish`);
    expect((await request(app).get(`/api/share/${token}`)).status).toBe(404);
  });

  it('exposes a public quiz without answer keys', async () => {
    const created = await agent.post('/api/quizzes').send(payload);
    const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
    const res = await request(app).get(`/api/share/${pub.body.quiz.shareToken}`);
    expect(res.status).toBe(200);
    expect(res.body.quiz.questionCount).toBe(1);
    expect(res.body.quiz.questions).toBeUndefined();
    expect(res.body.quiz.examineeFields[0].fieldId).toBe('name');
    expect(JSON.stringify(res.body)).not.toContain('correctOptionId');
  });

  it('enforces restricted access through invite tokens', async () => {
    const created = await agent.post('/api/quizzes').send({ ...payload, settings: { accessMode: 'restricted' } });
    const id = created.body.quiz.id as string;
    const pub = await agent.post(`/api/quizzes/${id}/publish`);
    const token = pub.body.quiz.shareToken as string;

    expect((await request(app).get(`/api/share/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${token}?invite=${secureToken(22)}`)).status).toBe(404);

    const inv = await agent.post(`/api/quizzes/${id}/invites`).send({ emails: ['Stu@School.edu', 'stu@school.edu'] });
    expect(inv.status).toBe(201);
    expect(inv.body.invites).toHaveLength(2);
    expect(inv.body.invites[0].token).toBe(inv.body.invites[1].token);

    const ok = await request(app).get(`/api/share/${token}?invite=${inv.body.invites[0].token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.quiz.lockedEmail).toBe('stu@school.edu');

    // Invite from another quiz must not unlock this one.
    const other = await agent.post('/api/quizzes').send({ ...payload, settings: { accessMode: 'restricted' } });
    const otherInv = await agent.post(`/api/quizzes/${other.body.quiz.id}/invites`).send({ emails: ['x@y.io'] });
    expect((await request(app).get(`/api/share/${token}?invite=${otherInv.body.invites[0].token}`)).status).toBe(404);

    expect((await agent.delete(`/api/quizzes/${id}/invites/${inv.body.invites[0].id}`)).status).toBe(204);
    expect((await request(app).get(`/api/share/${token}?invite=${inv.body.invites[0].token}`)).status).toBe(404);
  });

  it('rotates the share token and invalidates old links', async () => {
    const created = await agent.post('/api/quizzes').send(payload);
    const id = created.body.quiz.id as string;
    expect((await agent.post(`/api/quizzes/${id}/rotate-token`)).status).toBe(409);
    const pub = await agent.post(`/api/quizzes/${id}/publish`);
    const oldToken = pub.body.quiz.shareToken as string;
    const rotated = await agent.post(`/api/quizzes/${id}/rotate-token`);
    expect(rotated.status).toBe(200);
    const newToken = rotated.body.quiz.shareToken as string;
    expect(newToken).not.toBe(oldToken);
    expect((await request(app).get(`/api/share/${oldToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${newToken}`)).status).toBe(200);
  });

  it('never lists quizzes without authentication', async () => {
    expect((await request(app).get('/api/quizzes')).status).toBe(401);
    expect((await request(app).get('/api/share')).status).toBe(404);
  });
});
