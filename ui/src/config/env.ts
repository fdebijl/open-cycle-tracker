const BUILD_TIME_API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.trim()) ||
  'http://localhost:3000';

/** API base URL. Starts at the build-time default and is upgraded at startup by
 * loadRuntimeConfig() when the container shipped a /config.js. */
export let API_URL: string = BUILD_TIME_API_URL;

export let DEMO_MODE = false;

/** Load runtime config from the separately-served `/config.js`, an ES module
 * the UI container's entrypoint writes from $PUBLIC_API_URL on start. */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const mod = (await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}config.js`)) as {
      apiUrl?: string;
      demoMode?: boolean;
    };
    const apiUrl = mod.apiUrl?.trim();
    if (apiUrl) API_URL = apiUrl;
    if (mod.demoMode === true) DEMO_MODE = true;
  } catch {
    // No /config.js (dev, tests, or a build without the entrypoint), keep the build-time default.
  }
}

/** Default inactivity timeout before the vault auto-locks (wipes the DEK). */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** The inactivity timeouts offered in Settings > Security (in ms). There is no
 * "off" option: an unlocked, idle device should always wipe the key eventually. */
export const AUTO_LOCK_PRESETS_MS = [1, 5, 15, 30].map((minutes) => minutes * 60 * 1000);
