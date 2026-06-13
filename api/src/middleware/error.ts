import type { NextFunction, Request, Response } from 'express';
import { HttpError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** 404 fallthrough for unmatched routes. */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(notFound('Route not found'));
}

/**
 * Central error handler. Translates HttpError to its status/code, treats body
 * JSON parse errors as 400, and collapses everything else to a generic 500
 * (never leaking internals or stack traces to clients).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,

  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // express.json() throws a SyntaxError with a `status`/`type` on bad bodies.
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400
  ) {
    res.status(400).json({ error: { code: 'bad_request', message: 'Malformed JSON body' } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
}
