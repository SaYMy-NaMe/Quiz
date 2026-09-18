/**
 * Regression tests for the "404 / Access Denied when opening a copied share link in a new
 * tab or incognito window" bug. Every request here is made WITHOUT cookies or auth headers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');

const container = createContainer({ db: openDatabase(':memory:') });
const app = createApp(container, { clientDist: dist });
let token = '';

describe('public share link', () => {
  beforeAll(async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const created = await agent.post('/api/quizzes').send({
      title: 'Link',
      questions: [{ prompt: '2+2', options: [{ text: '4' }, { text: '5' }], correctIndex: 0 }],
    });
    const pub = await agent.post(`/api/quizzes/${created.body.quiz.id}/publish`);
    token = pub.body.quiz.shareToken;
  });
  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

  it('deep-links /quiz/v/:token to the SPA shell without NODE_ENV=production and without cookies', async () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    const res = await request(app).get(`/quiz/v/${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="root"');
    expect(res.headers['cache-control']).toBe('no-cache');
    // Nested examinee routes and unknown client routes fall back too.
    expect((await request(app).get(`/quiz/v/${token}/test`)).status).toBe(200);
    expect((await request(app).get('/dashboard')).status).toBe(200);
    // Static assets are served as-is; API and uploads never fall back to HTML.
    expect((await request(app).get('/assets/app.js')).text).toBe('console.log(1)');
    const api404 = await request(app).get('/api/nope');
    expect(api404.status).toBe(404);
    expect(api404.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/uploads/missing.png')).status).toBe(404);
  });

  it('serves the public quiz from both /api/share/:token and /api/quizzes/v/:token with no auth', async () => {
    for (const url of [`/api/share/${token}`, `/api/quizzes/v/${token}`]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
      expect(res.body.quiz.title).toBe('Link');
      expect(res.headers['cache-control']).toBe('no-store');
      // Security rule: no answer keys in any public payload.
      expect(JSON.stringify(res.body)).not.toMatch(/correctOptionId|correctIndex/);
    }
    // A stray Authorization header must not break public access either.
    expect((await request(app).get(`/api/share/${token}`).set('Authorization', 'Bearer garbage')).status).toBe(200);
  });

  it('does not send upgrade-insecure-requests unless HTTPS is declared', async () => {
    const res = await request(app).get(`/quiz/v/${token}`);
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});
