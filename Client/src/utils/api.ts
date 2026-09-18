/**
 * Central API client. Every request the app makes goes through `api` (or `apiFetch` for
 * non-JSON responses such as file downloads), so the base URL, credentials policy, error
 * shape and session-expiry handling live in exactly one place.
 */
import { API_BASE_URL } from './constants';

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

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

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

/** Absolute URL for an API path (`/quizzes` → `http://localhost:4000/api/quizzes`). */
export const apiUrl = (path: string): string => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Raw fetch against the API with the credentials policy applied. Use it when you need the
 * Response itself (blobs, streams); prefer `api.*` for JSON.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { credentials: 'include', ...init });
}

/** Extracts the API's `{ error: { code, message, details } }` envelope into an HttpError. */
export async function toHttpError(res: Response): Promise<HttpError> {
  let err: ErrorBody['error'];
  try {
    err = ((await res.json()) as ErrorBody).error;
  } catch {
    /* non-JSON body */
  }
  return new HttpError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? res.statusText, err?.details);
}

async function request<T>(method: Method, path: string, { body, signal }: RequestOptions = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const init: RequestInit = { method };
  if (isForm) init.body = body;
  else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;
  const res = await apiFetch(path, init);

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

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};
