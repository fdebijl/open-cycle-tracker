import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { revokedTokens, users } from '../../db/schema.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { issueAccessToken } from '../../lib/jwt.js';
import { hashAuthHash, verifyAuthHash } from '../../lib/password.js';
import { pseudoSalt } from '../../lib/prelogin.js';
import type { KdfParams } from '../../db/schema.js';
import type { LoginInput, PreloginInput, SignupInput } from './schema.js';

/**
 * Return the KDF salt + params the client needs to derive its authHash. For
 * unknown identifiers we return a deterministic pseudo-salt and generic params
 * so the response is indistinguishable from a real account (anti-enumeration).
 */
export async function prelogin(
  input: PreloginInput,
): Promise<{ saltAuth: string; kdfParams: KdfParams }> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
    columns: { saltAuth: true, kdfParams: true },
  });

  if (user) return { saltAuth: user.saltAuth, kdfParams: user.kdfParams };

  return {
    saltAuth: pseudoSalt(input.identifier),
    kdfParams: { algorithm: 'argon2id', opsLimit: 2, memLimit: 67108864 },
  };
}

export type AuthResult = {
  token: string;
  user: { id: string; identifier: string; email: string | null };
  saltKek: string;
  wrappedDek: string; // base64
  kdfParams: KdfParams;
};

export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
    columns: { id: true },
  });
  if (existing) throw conflict('Identifier already taken');

  const authHash = await hashAuthHash(input.authHash);

  const [created] = await db
    .insert(users)
    .values({
      identifier: input.identifier,
      email: input.email ?? null,
      authHash,
      saltAuth: input.saltAuth,
      saltKek: input.saltKek,
      saltRecovery: input.saltRecovery,
      kdfParams: input.kdfParams,
      wrappedDek: input.wrappedDek,
      wrappedDekRecovery: input.wrappedDekRecovery,
    })
    .returning();

  if (!created) throw new Error('Failed to create user');

  return {
    token: issueAccessToken(created.id).token,
    user: { id: created.id, identifier: created.identifier, email: created.email },
    saltKek: created.saltKek,
    wrappedDek: created.wrappedDek.toString('base64'),
    kdfParams: created.kdfParams,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
  });

  // Constant-ish work whether or not the user exists, plus generic error.
  const stored =
    user?.authHash ??
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ok = await verifyAuthHash(stored, input.authHash);
  if (!user || !ok) throw unauthorized('Invalid credentials');

  return {
    token: issueAccessToken(user.id).token,
    user: { id: user.id, identifier: user.identifier, email: user.email },
    saltKek: user.saltKek,
    wrappedDek: user.wrappedDek.toString('base64'),
    kdfParams: user.kdfParams,
  };
}

/** Revoke a token by adding its jti to the denylist until it would expire. */
export async function logout(jti: string, expiresAt: Date): Promise<void> {
  await db
    .insert(revokedTokens)
    .values({ jti, expiresAt })
    .onConflictDoNothing({ target: revokedTokens.jti });
}
