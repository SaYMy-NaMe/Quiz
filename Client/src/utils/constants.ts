/**
 * Environment resolution for the client. Everything that decides *where the API lives* is here.
 *
 * `VITE_API_BASE_URL` is baked in at build time by Vite from the active mode's env file:
 *   .env.development → http://localhost:4000            (npm run dev)
 *   .env.production  → https://your-app.vercel.app      (npm run build)
 *   .env.remote      → hosted API while developing      (npm run dev:remote)
 *   .env.local       → personal override, git-ignored, wins over all of the above
 *
 * `VITE_API_URL` is accepted as a legacy alias. An EMPTY value means same-origin `/api`
 * (Vite dev proxy, or the Express server serving the client build).
 */
const rawBase = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '';

/** Origin of the API server without a trailing slash, or '' for same-origin. */
export const API_ORIGIN: string = rawBase.trim().replace(/\/+$/, '');

/** Base for every REST call, e.g. `http://localhost:4000/api`. */
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const APP_NAME = 'Quiz Platform';

/** Key prefix for persisted examinee attempt state. */
export const STORAGE_PREFIX = 'quiz:';

export const APP_MODE: string = import.meta.env.MODE;
export const IS_DEV: boolean = import.meta.env.DEV;

/** Backwards-compatible bundle (older modules import `config`). */
export const config = {
  apiOrigin: API_ORIGIN,
  apiBaseUrl: API_BASE_URL,
  appName: APP_NAME,
  storagePrefix: STORAGE_PREFIX,
} as const;

/** Server-relative asset paths (e.g. `/uploads/x.png`) need the API origin when hosted apart. */
export const assetUrl = (path: string | null | undefined): string | undefined => {
  if (!path) return undefined;
  return /^(https?:)?\/\//.test(path) || path.startsWith('data:') ? path : `${API_ORIGIN}${path}`;
};
