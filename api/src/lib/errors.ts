/**
 * Typed application errors. Thrown from services/middleware and translated to
 * JSON responses by the central error handler. Messages are intentionally
 * terse and never leak whether a record exists for another user (we 404 rather
 * than 403 on cross-user access where it would otherwise reveal existence).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message = 'Bad request') => new HttpError(400, message, 'bad_request');
export const unauthorized = (message = 'Unauthorized') =>
  new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'Forbidden') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');
export const conflict = (message = 'Conflict') => new HttpError(409, message, 'conflict');
export const tooManyRequests = (message = 'Too many requests') =>
  new HttpError(429, message, 'too_many_requests');
