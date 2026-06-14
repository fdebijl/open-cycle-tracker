import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Anti-enumeration pseudo-salt. When /auth/prelogin is asked for an identifier
 * that does not exist, we must still return a plausible, STABLE 16-byte salt -
 * otherwise an attacker learns which identifiers are registered by observing
 * whether a real salt comes back. We derive it deterministically from the
 * identifier and a server secret so the same unknown identifier always yields
 * the same fake salt (as a real account would).
 */
export function pseudoSalt(identifier: string): string {
  const mac = createHmac('sha256', env.SERVER_SECRET).update(identifier).digest();
  // Salt is 16 bytes (crypto_pwhash_SALTBYTES); return base64 like real salts.
  return mac.subarray(0, 16).toString('base64');
}

/**
 * A deterministic, plausible-looking pseudo ciphertext blob for unknown
 * identifiers in the recovery flow, so a missing `wrappedDekRecovery` does not
 * reveal that an account is absent. Length matches a real recovery blob
 * (24-byte nonce + 32-byte DEK ciphertext + 16-byte tag = 72 bytes); derived by
 * expanding the server secret over the identifier.
 */
export function pseudoBlob(identifier: string, length = 72): string {
  const out = Buffer.alloc(length);
  let written = 0;
  let counter = 0;
  while (written < length) {
    const block = createHmac('sha256', env.SERVER_SECRET)
      .update(`${identifier}:wrapped_dek_recovery:${counter}`)
      .digest();
    const take = Math.min(block.length, length - written);
    block.copy(out, written, 0, take);
    written += take;
    counter += 1;
  }
  return out.toString('base64');
}
