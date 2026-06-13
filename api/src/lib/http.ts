import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async route handler so thrown errors / rejected promises reach the
 * Express error middleware instead of hanging the request.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
