import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

/**
 * Strict limiter for auth endpoints to blunt brute-force / credential-stuffing
 * (the original Rails app had no rate limiting at all). Disabled under test so
 * request specs aren't throttled; covered by a dedicated test that re-enables.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1_000_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Default key is the client IP. We intentionally do not log it (see logger).
  message: { error: { code: 'too_many_requests', message: 'Too many attempts, try later.' } },
});

/** Looser limiter for general API traffic. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1_000_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
