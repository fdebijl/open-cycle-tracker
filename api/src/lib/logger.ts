import { pino } from 'pino';
import { isProd, isTest } from '../config/env.js';

/**
 * Application logger. Deliberately minimal: this is a tracker for users with a
 * state-level threat model, so we do NOT log IPs, request bodies, headers, or
 * anything that could tie an identity to activity. See pino-http config in
 * middleware/httpLogger.ts for the request-logging redaction.
 */
export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  // No timestamps in prod logs beyond coarse level info is fine; keep default.
  base: undefined, // drop pid/hostname
});
