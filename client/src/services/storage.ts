import { config } from '@/config';

/** Adapter over Web Storage with namespacing and JSON (de)serialisation. */
export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

function createWebStorage(backend: Storage | null): StorageAdapter {
  const k = (key: string) => `${config.storagePrefix}${key}`;
  return {
    get<T>(key: string): T | null {
      try {
        const raw = backend?.getItem(k(key));
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        backend?.setItem(k(key), JSON.stringify(value));
      } catch {
        /* storage may be unavailable (private mode); persistence is best-effort */
      }
    },
    remove(key) {
      try {
        backend?.removeItem(k(key));
      } catch {
        /* ignore */
      }
    },
  };
}

const safe = (getter: () => Storage): Storage | null => {
  try {
    return getter();
  } catch {
    return null;
  }
};

export const localStore: StorageAdapter = createWebStorage(safe(() => window.localStorage));
export const sessionStore: StorageAdapter = createWebStorage(safe(() => window.sessionStorage));
