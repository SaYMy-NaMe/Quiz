import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createCorsMiddleware } from './cors';

const app = express();
app.use(createCorsMiddleware(['http://localhost:5173', 'https://your-app.vercel.app', 'https://*.vercel.app']));
app.get('/ping', (_req, res) => res.json({ ok: true }));

describe('dynamic CORS allow-list', () => {
  it('echoes allowed origins with credentials', async () => {
    for (const origin of ['http://localhost:5173', 'https://your-app.vercel.app', 'https://quiz-git-feature-x.vercel.app']) {
      const res = await request(app).get('/ping').set('Origin', origin);
      expect(res.headers['access-control-allow-origin'], origin).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });

  it('answers preflight for allowed origins', async () => {
    const res = await request(app).options('/ping').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });

  it('withholds CORS headers from unknown origins and allows origin-less requests', async () => {
    const evil = await request(app).get('/ping').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const deep = await request(app).get('/ping').set('Origin', 'https://a.b.vercel.app');
    expect(deep.headers['access-control-allow-origin']).toBeUndefined(); // wildcard = one label only
    const bare = await request(app).get('/ping');
    expect(bare.status).toBe(200);
  });
});
