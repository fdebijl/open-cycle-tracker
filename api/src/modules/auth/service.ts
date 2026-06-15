import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { revokedTokens, users, type User } from '../../db/schema.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { issueAccessToken } from '../../lib/jwt.js';
import { hashAuthHash, verifyAuthHash } from '../../lib/password.js';
import { pseudoBlob, pseudoSalt } from '../../lib/prelogin.js';
import type { KdfParams } from '../../db/schema.js';
import type {
  DuressConfigInput,
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
    saltAuth: user.saltAuth,
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
  saltAuth: string;
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

/**
 * Wipe an account and its decoy. The self-FK (`duressUserId`) is ON DELETE SET
 * NULL, not cascade, so the shadow (decoy) row is deleted explicitly; each
 * delete cascades to that user's cycles/days/factors.
 */
async function destroyAccount(user: User): Promise<void> {
  if (user.duressUserId) {
    await db.delete(users).where(eq(users.id, user.duressUserId));
  }
  await db.delete(users).where(eq(users.id, user.id));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
  });

  // The client derives ONE authHash (from the account's single saltAuth), so the
  // same value is compared against every configured verifier. Run a fixed number
  // of argon2 verifications regardless of which exist, so timing leaks neither
  // which password matched nor how many an account has (roadmap #14).
  const [realOk, duressOk, destructOk] = await Promise.all([
    verifyAuthHash(user?.authHash ?? DUMMY_ARGON, input.authHash),
    verifyAuthHash(user?.duressAuthHash ?? DUMMY_ARGON, input.authHash),
    verifyAuthHash(user?.destructAuthHash ?? DUMMY_ARGON, input.authHash),
  ]);

  // Real password wins (in case an account misconfigures a duplicate).
  if (user && realOk) return authResultFor(user);

  // Duress password → hand back the decoy (shadow) vault's session. The existing
  // per-user scoping then isolates the decoy's data for the whole session.
  if (user && duressOk && user.duressUserId) {
    const shadow = await db.query.users.findFirst({ where: eq(users.id, user.duressUserId) });
    if (shadow) return authResultFor(shadow);
  }

  // Destruction password → silently wipe, then fail exactly like a wrong password.
  if (user && destructOk) {
    await destroyAccount(user);
  }

  throw unauthorized('Invalid credentials');
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
  saltAuth: string;
  saltRecovery: string;
  saltRecoveryAuth: string;
  wrappedDekRecovery: string;
  kdfParams: KdfParams;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
    columns: { saltAuth: true, saltRecovery: true, saltRecoveryAuth: true, wrappedDekRecovery: true, kdfParams: true },
  });

  if (user) {
    return {
      // Returned so the client reuses the account's stable saltAuth when setting
      // new password material, keeping any duress/destruct verifiers valid.
      saltAuth: user.saltAuth,
      saltRecovery: user.saltRecovery,
      saltRecoveryAuth: user.saltRecoveryAuth,
      wrappedDekRecovery: user.wrappedDekRecovery.toString('base64'),
      kdfParams: user.kdfParams,
    };
  }

  return {
    saltAuth: pseudoSalt(input.identifier),
    saltRecovery: pseudoSalt(`${input.identifier}:rec`),
    saltRecoveryAuth: pseudoSalt(`${input.identifier}:recauth`),
    wrappedDekRecovery: pseudoBlob(input.identifier),
    kdfParams: { algorithm: 'argon2id', opsLimit: 2, memLimit: 67108864 },
  };
}

/**
 * Configure duress (decoy-vault) and destruction passwords from an authenticated
 * (real) session (roadmap #14). Each field is tri-state: undefined leaves it
 * unchanged, `null` clears it, a value sets it. The decoy is created as a
 * separate "shadow" users row that owns its own data; the primary points at it
 * via `duressUserId` and stores the verifiers.
 */
export async function configureDuress(userId: string, input: DuressConfigInput): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw unauthorized();

  const patch: Partial<typeof users.$inferInsert> = {};

  if (input.duress !== undefined) {
    // Drop any previous decoy before (re)setting, so its data is not orphaned.
    if (user.duressUserId) {
      await db.delete(users).where(eq(users.id, user.duressUserId));
    }
    if (input.duress === null) {
      patch.duressUserId = null;
      patch.duressAuthHash = null;
    } else {
      const s = input.duress.shadow;
      const [shadow] = await db
        .insert(users)
        .values({
          identifier: randomUUID(),
          authHash: await hashAuthHash(s.authHash),
          recoveryAuthHash: await hashAuthHash(s.recoveryAuthHash),
          saltAuth: s.saltAuth,
          saltKek: s.saltKek,
          saltRecovery: s.saltRecovery,
          saltRecoveryAuth: s.saltRecoveryAuth,
          kdfParams: s.kdfParams,
          wrappedDek: s.wrappedDek,
          wrappedDekRecovery: s.wrappedDekRecovery,
        })
        .returning({ id: users.id });
      if (!shadow) throw new Error('Failed to create decoy vault');
      patch.duressUserId = shadow.id;
      patch.duressAuthHash = await hashAuthHash(input.duress.duressAuthHash);
    }
  }

  if (input.destructAuthHash !== undefined) {
    patch.destructAuthHash =
      input.destructAuthHash === null ? null : await hashAuthHash(input.destructAuthHash);
  }

  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, userId));
  }
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
