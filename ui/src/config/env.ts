/**
 * Runtime configuration, read from Vite env vars at build time.
 * In tests `import.meta.env` is undefined, so we fall back to the dev default.
 */
export const API_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000';

/** Wipe the in-memory key this many ms after the last user activity. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;
