export const API_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000';

/** Default inactivity timeout before the vault auto-locks (wipes the DEK). Also
 * the value used until the user's stored preference loads after unlock. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** The inactivity timeouts offered in Settings → Security (in ms). There is no
 * "off" option: an unlocked, idle device should always wipe the key eventually. */
export const AUTO_LOCK_PRESETS_MS = [1, 5, 15, 30].map((minutes) => minutes * 60 * 1000);
