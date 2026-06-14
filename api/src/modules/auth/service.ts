import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { revokedTokens, users, type User } from '../../db/schema.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { issueAccessToken } from '../../lib/jwt.js';
import { hashAuthHash, verifyAuthHash } from '../../lib/password.js';
import { pseudoBlob, pseudoSalt } from '../../lib/prelogin.js';
import type { KdfParams } from '../../db/schema.js';
import type {
  LoginInput,
  PasswordChangeInput,
  PreloginInput,
  RecoverInitInput,
  RecoverInput,
  SignupInput,
} from './schema.js';

/**
 * A dummy argon2id hash to verify against when no user matches, so login and
 * recovery do roughly constant work and don't leak account existence by timing.
 */
const DUMMY_ARGON =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function authResultFor(user: User): AuthResult {
  return {
    token: issueAccessToken(user.id).token,
    user: { id: user.id, identifier: user.identifier, email: user.email },
    saltKek: user.saltKek,
    wrappedDek: user.wrappedDek.toString('base64'),
    kdfParams: user.kdfParams,
  };
}

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
  const recoveryAuthHash = await hashAuthHash(input.recoveryAuthHash);

  const [created] = await db
    .insert(users)
    .values({
      identifier: input.identifier,
      email: input.email ?? null,
      authHash,
      recoveryAuthHash,
      saltAuth: input.saltAuth,
      saltKek: input.saltKek,
      saltRecovery: input.saltRecovery,
      saltRecoveryAuth: input.saltRecoveryAuth,
      kdfParams: input.kdfParams,
      wrappedDek: input.wrappedDek,
      wrappedDekRecovery: input.wrappedDekRecovery,
    })
    .returning();

  if (!created) throw new Error('Failed to create user');

  return authResultFor(created);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
  });

  // Constant-ish work whether or not the user exists, plus generic error.
  const stored = user?.authHash ?? DUMMY_ARGON;
  const ok = await verifyAuthHash(stored, input.authHash);
  if (!user || !ok) throw unauthorized('Invalid credentials');

  return authResultFor(user);
}

/** Revoke a token by adding its jti to the denylist until it would expire. */
export async function logout(jti: string, expiresAt: Date): Promise<void> {
  await db
    .insert(revokedTokens)
    .values({ jti, expiresAt })
    .onConflictDoNothing({ target: revokedTokens.jti });
}

/**
 * Change the password of an authenticated user. The client re-wrapped its
 * in-memory DEK under the new password and sends fresh auth/KEK material; the
 * encrypted data and the recovery wrapping are untouched, so this is cheap.
 */
export async function changePassword(userId: string, input: PasswordChangeInput): Promise<void> {
  const authHash = await hashAuthHash(input.authHash);
  const [updated] = await db
    .update(users)
    .set({
      authHash,
      saltAuth: input.saltAuth,
      saltKek: input.saltKek,
      wrappedDek: input.wrappedDek,
      kdfParams: input.kdfParams,
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!updated) throw unauthorized();
}

/**
 * Step 1 of recovery: return the material the client needs to unwrap the DEK
 * from the recovery code (`saltRecovery`, `wrappedDekRecovery`) and to derive
 * the recovery verifier (`saltRecoveryAuth`). Exposing `wrappedDekRecovery`
 * pre-auth is safe: it is only openable with the 256-bit recovery code. Unknown
 * identifiers get deterministic pseudo material (anti-enumeration).
 */
export async function recoverInit(input: RecoverInitInput): Promise<{
  saltRecovery: string;
  saltRecoveryAuth: string;
  wrappedDekRecovery: string;
  kdfParams: KdfParams;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
    columns: { saltRecovery: true, saltRecoveryAuth: true, wrappedDekRecovery: true, kdfParams: true },
  });

  if (user) {
    return {
      saltRecovery: user.saltRecovery,
      saltRecoveryAuth: user.saltRecoveryAuth,
      wrappedDekRecovery: user.wrappedDekRecovery.toString('base64'),
      kdfParams: user.kdfParams,
    };
  }

  return {
    saltRecovery: pseudoSalt(`${input.identifier}:rec`),
    saltRecoveryAuth: pseudoSalt(`${input.identifier}:recauth`),
    wrappedDekRecovery: pseudoBlob(input.identifier),
    kdfParams: { algorithm: 'argon2id', opsLimit: 2, memLimit: 67108864 },
  };
}

/**
 * Step 2 of recovery: verify the recovery verifier, then set new password
 * material (as in a password change) and return a fresh session token. The
 * server cannot perform recovery itself - by design - so it cannot be compelled
 * to.
 */
export async function recover(input: RecoverInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
  });

  const stored = user?.recoveryAuthHash ?? DUMMY_ARGON;
  const ok = await verifyAuthHash(stored, input.recoveryAuthHash);
  if (!user || !ok) throw unauthorized('Invalid recovery code');

  const authHash = await hashAuthHash(input.authHash);
  const [updated] = await db
    .update(users)
    .set({
      authHash,
      saltAuth: input.saltAuth,
      saltKek: input.saltKek,
      wrappedDek: input.wrappedDek,
      kdfParams: input.kdfParams,
    })
    .where(eq(users.id, user.id))
    .returning();
  if (!updated) throw unauthorized();

  return authResultFor(updated);
}
