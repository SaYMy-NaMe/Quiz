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

describe('auth error surfacing', () => {
  it('maps a unique-index race on email to 409 and malformed JSON to 400', async () => {
    const { UserModel } = await import('./user.model');
    await UserModel.create({ email: 'dup@x.io', name: 'A', passwordHash: 'x' });
    // Bypass the pre-check to simulate two concurrent registrations hitting the unique index.
    await expect(UserModel.create({ email: 'dup@x.io', name: 'B', passwordHash: 'y' })).rejects.toMatchObject({ code: 11000 });
    const res = await request(app).post('/api/auth/register').send({ name: 'B', email: 'dup@x.io', password: 'password123' });
    expect(res.status).toBe(409);
    const bad = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{not json');
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toMatch(/Malformed JSON/);
  });
});
