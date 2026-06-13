import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Injected before any module loads. dotenv (in config/env.ts) does NOT
    // override already-set vars, so these win over .env during tests.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://fdebijl@localhost/oct_test?host=/var/run/postgresql',
      JWT_SECRET: 'test-jwt-secret-value-not-for-production-use',
      SERVER_SECRET: 'test-server-secret-value-not-for-production-use',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
