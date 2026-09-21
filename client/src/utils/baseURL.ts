/**
 * Backend target. Switch servers by commenting/uncommenting — nothing else to configure.
 * The value must include the `/api` prefix and no trailing slash.
 */
export const BASE_URL = 'http://localhost:4000/api';
// export const BASE_URL = 'https://your-production-backend.vercel.app/api';

/** Origin of the backend (for server-hosted assets such as uploaded images). */
export const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');
