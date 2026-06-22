import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

/** Strict limiter for auth endpoints to blunt brute-force / credential-stuffing */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: isTest ? 1_000_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'too_many_requests', message: 'Too many attempts, try later.' } },
});

/** Looser limiter for general API traffic. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: isTest ? 1_000_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
