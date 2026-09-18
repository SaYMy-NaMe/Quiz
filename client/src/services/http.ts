import { config } from '@/config';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type UnauthorizedListener = (path: string) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/**
 * Observer hook for session expiry: the auth store subscribes so that any 401 from an
 * instructor endpoint clears the cached session and redirects to /login. Examinee (token)
 * endpoints never return 401, so this cannot disturb an exam in progress.
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

/** Thin fetch wrapper: JSON in/out, cookie credentials, typed errors. */
async function request<T>(method: Method, path: string, { body, signal }: RequestOptions = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const init: RequestInit = { method, credentials: 'include' };
  if (isForm) init.body = body;
  else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;
  const res = await fetch(`${config.apiBaseUrl}${path}`, init);

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (data as ErrorBody | null)?.error;
    if (res.status === 401 && !path.startsWith('/auth/')) unauthorizedListeners.forEach((l) => l(path));
    throw new HttpError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? res.statusText, err?.details);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};
