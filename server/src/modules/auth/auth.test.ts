import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, instructorAgent } from '@/test/helpers';

describe('auth (JWT)', () => {
  it('registers, sets an httpOnly JWT cookie and resolves /me', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({ name: 'Ada', email: 'Ada@Example.com', password: 'supersecret1' });
    expect(res.status).toBe(201);
    expect(res.body.instructor.email).toBe('ada@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/quiz_token=.*HttpOnly/);
    const me = await agent.get('/api/auth/me');
    expect(me.body.instructor.name).toBe('Ada');
  });

  it('accepts a Bearer token, rejects bad credentials and duplicates', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const token = /quiz_token=([^;]+)/.exec(reg.headers['set-cookie']![0]!)![1];
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send({ name: 'B', email: 'a@x.io', password: 'password123' })).status).toBe(409);
    expect((await request(app).post('/api/auth/login').send({ email: 'a@x.io', password: 'wrong-password' })).status).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const agent = await instructorAgent();
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
