import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';

describe('auth module', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(createContainer({ db: openDatabase(':memory:') }));
  });

  it('registers, returns a session cookie and resolves /me', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'supersecret1' });
    expect(res.status).toBe(201);
    expect(res.body.instructor.email).toBe('ada@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/quiz_session=.*HttpOnly/);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.instructor.name).toBe('Ada');
  });

  it('rejects duplicate registration and bad credentials', async () => {
    await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const dup = await request(app).post('/api/auth/register').send({ name: 'B', email: 'a@x.io', password: 'password123' });
    expect(dup.status).toBe(409);
    const bad = await request(app).post('/api/auth/login').send({ email: 'a@x.io', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('guards /me and clears session on logout', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
