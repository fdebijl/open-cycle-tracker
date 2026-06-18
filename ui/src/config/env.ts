const BUILD_TIME_API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.trim()) ||
  'http://localhost:3000';

/** API base URL. Starts at the build-time default and is upgraded at startup by
 * loadRuntimeConfig() when the container shipped a /config.js. It's a live
 * binding read lazily per request (see api/client.ts), so the post-load value
 * is what actually gets used. */
export let API_URL: string = BUILD_TIME_API_URL;

/** Load runtime config from the separately-served `/config.js` — an ES module
 * the UI container's entrypoint writes from $PUBLIC_API_URL on start. It's
 * pulled via a dynamic import of an absolute path (deliberately NOT a static
 * import) so it stays OUT of the bundle and can be swapped per deploy without a
 * rebuild. Must be awaited before the first API call; main.tsx does so before
 * render. No-op (keeps the build-time default) if the file is absent or empty,
 * which is the case in dev and tests. */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const mod = (await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}config.js`)) as {
      apiUrl?: string;
    };
    const apiUrl = mod.apiUrl?.trim();
    if (apiUrl) API_URL = apiUrl;
  } catch {
    // No /config.js (dev, tests, or a build without the entrypoint) — keep the
    // build-time default.
  }
}

/** Default inactivity timeout before the vault auto-locks (wipes the DEK). Also
 * the value used until the user's stored preference loads after unlock. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** The inactivity timeouts offered in Settings → Security (in ms). There is no
 * "off" option: an unlocked, idle device should always wipe the key eventually. */
export const AUTO_LOCK_PRESETS_MS = [1, 5, 15, 30].map((minutes) => minutes * 60 * 1000);
