import { SERVER_ORIGIN } from './baseURL';

export const APP_NAME = 'Quiz Platform';

/** Key prefix for persisted examinee attempt state. */
export const STORAGE_PREFIX = 'quiz:';

/** Server-relative asset paths (e.g. `/uploads/x.png`) are served by the backend origin. */
export const assetUrl = (path: string | null | undefined): string | undefined => {
  if (!path) return undefined;
  return /^(https?:)?\/\//.test(path) || path.startsWith('data:') ? path : `${SERVER_ORIGIN}${path}`;
};
