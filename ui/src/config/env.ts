export const API_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000';

export const AUTO_LOCK_MS = 5 * 60 * 1000;
