/**
 * Runtime configuration. `VITE_API_URL` is baked in at build time by Vite:
 *   - set it to the API origin (e.g. https://api.example.com) for a separately hosted client;
 *   - leave it empty to call same-origin `/api` (Vite dev proxy, or the server serving the build).
 */
const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const config = {
  apiOrigin,
  apiBaseUrl: `${apiOrigin}/api`,
  appName: 'Quiz Platform',
  /** Key prefix for persisted examinee attempt state. */
  storagePrefix: 'quiz:',
} as const;

/** Server-relative asset paths (e.g. `/uploads/x.png`) need the API origin when hosted apart. */
export const assetUrl = (path: string | null | undefined): string | undefined => {
  if (!path) return undefined;
  return /^(https?:)?\/\//.test(path) || path.startsWith('data:') ? path : `${apiOrigin}${path}`;
};
