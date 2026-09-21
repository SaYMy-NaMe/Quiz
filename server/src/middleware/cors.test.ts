import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createCorsMiddleware } from './cors';

const app = express();
app.use(createCorsMiddleware(['http://localhost:5173', 'https://*.vercel.app']));
app.get('/ping', (_req, res) => res.json({ ok: true }));

describe('CORS allow-list from CLIENT_ORIGIN', () => {
  it('echoes allowed origins with credentials, ignores unknown ones', async () => {
    for (const origin of ['http://localhost:5173', 'https://preview-x.vercel.app']) {
      const res = await request(app).get('/ping').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
    expect((await request(app).get('/ping').set('Origin', 'https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(app).get('/ping')).status).toBe(200);
  });
});
