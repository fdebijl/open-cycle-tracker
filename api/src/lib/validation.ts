import { z } from 'zod';

/** True if `str` is valid standard (padded) base64 that round-trips. */
function isBase64(str: string): boolean {
  if (str.length === 0 || str.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return false;
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

/** A non-empty, well-formed base64 string (kept as a string). */
export const base64String = z.string().refine(isBase64, { message: 'must be valid base64' });

/**
 * A base64 string decoded to a Buffer for `bytea` storage, with optional exact
 * and maximum decoded-length checks (defends against oversized ciphertext).
 */
export function base64Bytes(opts: { exactLen?: number; maxLen?: number } = {}) {
  return base64String.transform((str, ctx) => {
    const buf = Buffer.from(str, 'base64');
    if (opts.exactLen !== undefined && buf.length !== opts.exactLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `must decode to ${opts.exactLen} bytes`,
      });
      return z.NEVER;
    }
    if (opts.maxLen !== undefined && buf.length > opts.maxLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `must decode to at most ${opts.maxLen} bytes`,
      });
      return z.NEVER;
    }
    return buf;
  });
}

const SALT_BYTES = 16;
/** Upper bound for any single encrypted field blob (nonce + ciphertext+tag). */
export const MAX_CIPHER_BYTES = 64 * 1024;

/** A 16-byte salt, transported as base64, kept as a base64 string for storage. */
export const saltString = base64String.refine(
  (str) => Buffer.from(str, 'base64').length === SALT_BYTES,
  { message: `salt must decode to ${SALT_BYTES} bytes` },
);

export const kdfParamsSchema = z.object({
  algorithm: z.literal('argon2id'),
  opsLimit: z.number().int().positive(),
  memLimit: z.number().int().positive(),
});

/** A ciphertext field blob (nonce || ciphertext+tag) > Buffer for storage. */
export const cipherField = base64Bytes({ maxLen: MAX_CIPHER_BYTES });

export const uuidString = z.string().uuid();
