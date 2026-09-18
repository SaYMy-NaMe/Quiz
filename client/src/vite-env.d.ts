/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin, e.g. http://localhost:4000 (empty = same-origin). */
  readonly VITE_API_BASE_URL?: string;
  /** Legacy alias of VITE_API_BASE_URL. */
  readonly VITE_API_URL?: string;
}
