import { z } from 'zod';
import { base64String, base64Bytes, kdfParamsSchema, saltString } from '../../lib/validation.js';

/** Identifier: a username. Pseudonymous by design — email is optional. */
const identifier = z.string().trim().min(1).max(200);

export const preloginSchema = z.object({
  identifier,
});

export const signupSchema = z.object({
  identifier,
  email: z.string().email().max(320).optional(),
  // Login verifier (client already ran Argon2id over the password). Stored
  // re-hashed; kept as a base64 string, not decoded.
  authHash: base64String,
  // Recovery verifier (client ran Argon2id over the recovery code). Stored
  // re-hashed; gates the forgotten-password flow.
  recoveryAuthHash: base64String,
  // Public KDF inputs.
  saltAuth: saltString,
  saltKek: saltString,
  saltRecovery: saltString,
  saltRecoveryAuth: saltString,
  kdfParams: kdfParamsSchema,
  // Envelope: DEK wrapped under password-KEK and recovery-KEK (bytea).
  wrappedDek: base64Bytes({ maxLen: 1024 }),
  wrappedDekRecovery: base64Bytes({ maxLen: 1024 }),
});

export const loginSchema = z.object({
  identifier,
  authHash: base64String,
});

/**
 * New auth material when changing the password (authenticated) — the client
 * re-wrapped its in-memory DEK under a new password and derived a fresh
 * authHash. The recovery wrapping is intentionally left untouched.
 */
export const passwordChangeSchema = z.object({
  authHash: base64String,
  saltAuth: saltString,
  saltKek: saltString,
  wrappedDek: base64Bytes({ maxLen: 1024 }),
  kdfParams: kdfParamsSchema,
});

/** Step 1 of recovery: fetch the recovery wrapping material by identifier. */
export const recoverInitSchema = z.object({
  identifier,
});

/**
 * Step 2 of recovery: prove knowledge of the recovery code (recoveryAuthHash)
 * and set new password material. Same shape as a password change plus the
 * identifier + recovery verifier.
 */
export const recoverSchema = z.object({
  identifier,
  recoveryAuthHash: base64String,
  authHash: base64String,
  saltAuth: saltString,
  saltKek: saltString,
  wrappedDek: base64Bytes({ maxLen: 1024 }),
  kdfParams: kdfParamsSchema,
});

export type PreloginInput = z.infer<typeof preloginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type RecoverInitInput = z.infer<typeof recoverInitSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
