/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose the package version as a compile-time constant for the About tab.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Crypto/unit tests run in node (libsodium works, Worker is undefined so the
    // KDF falls back to a direct call). Component tests opt into jsdom per-file
    // with `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
