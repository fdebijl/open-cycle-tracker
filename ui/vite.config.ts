/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
