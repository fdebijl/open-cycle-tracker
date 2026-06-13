import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { revokedTokens, users } from '../db/schema.js';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

function extractBearer(req: Request): string {
  const header = req.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Missing bearer token');
  }
  return header.slice('Bearer '.length).trim();
}

/**
 * Authenticate the request: verify the JWT, reject revoked (logged-out) tokens
 * via the denylist, confirm the user still exists, and attach `req.auth`.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearer(req);
    const claims = verifyAccessToken(token);

    const revoked = await db.query.revokedTokens.findFirst({
      where: eq(revokedTokens.jti, claims.jti),
    });
    if (revoked) throw unauthorized('Token has been revoked');

    const user = await db.query.users.findFirst({
      where: eq(users.id, claims.sub),
      columns: { id: true, isAdmin: true },
    });
    if (!user) throw unauthorized('User no longer exists');

    req.auth = {
      userId: user.id,
      isAdmin: user.isAdmin,
      jti: claims.jti,
      tokenExpiresAt: new Date(claims.exp * 1000),
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Convenience accessor that asserts auth is present (after requireAuth). */
export function requireAuthCtx(req: Request) {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
