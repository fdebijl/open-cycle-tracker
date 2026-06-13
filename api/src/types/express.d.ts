/**
 * Augment Express's Request with the authenticated principal set by
 * requireAuth. Kept minimal: the server knows only an opaque user id, an admin
 * flag, and the token's jti (for logout/revocation). It learns nothing about
 * the user's encrypted content.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        isAdmin: boolean;
        jti: string;
        tokenExpiresAt: Date;
      };
    }
  }
}

export {};
