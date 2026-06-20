// Runtime configuration module, imported dynamically at startup (see
// src/config/env.ts). This default ships in the bundle output so dev and a
// plain `pnpm build` have the file present; an empty apiUrl makes the app fall
// back to the build-time VITE_API_URL and then to http://localhost:3000.
//
// In the Docker image this file is OVERWRITTEN at container start by the
// entrypoint, which substitutes $PUBLIC_API_URL. Editing it here only affects
// local dev/build, not the deployed container.
export const apiUrl = '';
export const demoMode = false;
