import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/index.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Open Cycle Tracker API listening on :${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
