import { hash, verify } from '@node-rs/argon2';

/**
 * Server-side hashing of the client's authHash (a "double hash"). The client
 * already ran Argon2id(password) > authHash; we hash THAT again with a fresh
 * server-side Argon2id salt so a DB leak reveals neither the password nor the
 * authHash. We never see the password itself.
 */
const OPTS = {
  // argon2id defaults; tuned modestly since the input is already a 32-byte
  // high-entropy value, not a low-entropy human password.
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashAuthHash(authHashB64: string): Promise<string> {
  return hash(authHashB64, OPTS);
}

export function verifyAuthHash(stored: string, authHashB64: string): Promise<boolean> {
  return verify(stored, authHashB64, OPTS);
}
