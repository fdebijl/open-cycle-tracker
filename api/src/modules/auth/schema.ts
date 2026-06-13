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
  // Public KDF inputs.
  saltAuth: saltString,
  saltKek: saltString,
  saltRecovery: saltString,
  kdfParams: kdfParamsSchema,
  // Envelope: DEK wrapped under password-KEK and recovery-KEK (bytea).
  wrappedDek: base64Bytes({ maxLen: 1024 }),
  wrappedDekRecovery: base64Bytes({ maxLen: 1024 }),
});

export const loginSchema = z.object({
  identifier,
  authHash: base64String,
});

export type PreloginInput = z.infer<typeof preloginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
