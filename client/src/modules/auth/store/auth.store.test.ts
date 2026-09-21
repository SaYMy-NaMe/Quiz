import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth.store';
import { api } from '@/utils/api';

describe('auth store session guard', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', instructor: { id: '1', email: 'a@b.c', name: 'A', createdAt: '' } });
  });

  it('expires the local session when an instructor endpoint returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x' } }), { status: 401 }))));
    await expect(api.get('/quizzes')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().instructor).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores 401s from the auth endpoints themselves (bad password is not an expiry)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { message: 'Invalid' } }), { status: 401 }))));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('authenticated');
    vi.unstubAllGlobals();
  });
});

describe('network failures are explained, not generic', () => {
  it('turns a rejected fetch into a NETWORK_ERROR HttpError naming the server', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR', message: expect.stringContaining('localhost:4000') });
    vi.unstubAllGlobals();
  });
  it('flags a non-JSON response (wrong BASE_URL) instead of throwing a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<!doctype html>', { status: 200 }))));
    await expect(api.get('/auth/me')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    vi.unstubAllGlobals();
  });
});
