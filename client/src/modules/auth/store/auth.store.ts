import { create } from 'zustand';
import type { Credentials, Instructor, RegisterPayload } from '@shared';
import { authApi } from '../services/auth.api';
import { HttpError, onUnauthorized } from '@/utils/api';
import { sessionStore } from '@/services/storage';

type Status = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  instructor: Instructor | null;
  bootstrap: () => Promise<void>;
  login: (payload: Credentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Drops the local session after the server rejected it (expired / revoked). */
  expire: () => void;
}

const CACHE_KEY = 'auth:instructor';

/**
 * Session is owned by the server (httpOnly cookie). We keep a lightweight
 * sessionStorage mirror so the UI can render optimistically before `/me` resolves.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  instructor: sessionStore.get<Instructor>(CACHE_KEY),

  async bootstrap() {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    try {
      const { instructor } = await authApi.me();
      sessionStore.set(CACHE_KEY, instructor);
      set({ status: 'authenticated', instructor });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        sessionStore.remove(CACHE_KEY);
        set({ status: 'anonymous', instructor: null });
      } else {
        set({ status: 'anonymous' });
      }
    }
  },

  async login(payload) {
    const { instructor } = await authApi.login(payload);
    sessionStore.set(CACHE_KEY, instructor);
    set({ status: 'authenticated', instructor });
  },

  async register(payload) {
    const { instructor } = await authApi.register(payload);
    sessionStore.set(CACHE_KEY, instructor);
    set({ status: 'authenticated', instructor });
  },

  async logout() {
    await authApi.logout().catch(() => undefined);
    sessionStore.remove(CACHE_KEY);
    set({ status: 'anonymous', instructor: null });
  },

  expire() {
    sessionStore.remove(CACHE_KEY);
    set({ status: 'anonymous', instructor: null });
  },
}));

onUnauthorized(() => {
  if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().expire();
});
