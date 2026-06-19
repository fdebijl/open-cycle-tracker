import { createApp } from './app.js';
import { env, isDemo } from './config/env.js';
import { pool } from './db/index.js';
import { wipeAllData } from './db/demoReset.js';
import { logger } from './lib/logger.js';

const app = createApp();

if (isDemo) {
  logger.warn(
    `DEMO MODE ON — all data is wiped every ${env.DEMO_WIPE_INTERVAL_MINUTES} minute(s). Do not use with real data.`,
  );
  setInterval(
    () => {
      void wipeAllData().catch((err) => logger.error(err, 'demo wipe failed'));
    },
    env.DEMO_WIPE_INTERVAL_MINUTES * 60_000,
  ).unref();
}

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
