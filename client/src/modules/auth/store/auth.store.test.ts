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
