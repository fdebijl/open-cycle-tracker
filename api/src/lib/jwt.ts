import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

export type AccessTokenClaims = {
  sub: string; // user id
  jti: string; // token id (for revocation denylist)
  iat: number;
  exp: number;
};

export type IssuedToken = {
  token: string;
  jti: string;
  expiresAt: Date;
};

/** Issue a signed access token for a user, with a fresh jti for revocation. */
export function issueAccessToken(userId: string): IssuedToken {
  const jti = randomUUID();
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    jwtid: jti,
    expiresIn: env.JWT_EXPIRES_IN,
  });
  const expiresAt = new Date(Date.now() + env.JWT_EXPIRES_IN * 1000);
  return { token, jti, expiresAt };
}

/** Verify a token's signature/expiry and return its claims, or throw 401. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub || !decoded.jti) {
      throw unauthorized('Malformed token');
    }
    return decoded as AccessTokenClaims;
  } catch (err) {
    if (err instanceof Error && err.name === 'HttpError') throw err;
    throw unauthorized('Invalid or expired token');
  }
}
