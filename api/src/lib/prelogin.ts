import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Anti-enumeration pseudo-salt. When /auth/prelogin is asked for an identifier
 * that does not exist, we must still return a plausible, STABLE 16-byte salt —
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
