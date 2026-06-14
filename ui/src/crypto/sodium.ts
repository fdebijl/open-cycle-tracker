import _sodium from 'libsodium-wrappers-sumo';

let readyPromise: Promise<typeof _sodium> | null = null;

/**
 * Returns the initialized libsodium instance. We use the **sumo** build because
 * the standard `libsodium-wrappers` build omits `crypto_pwhash` (Argon2id),
 * which this app's key derivation depends on. Safe to call repeatedly - the
 * `ready` promise resolves once and is cached.
 */
export function getSodium(): Promise<typeof _sodium> {
  if (!readyPromise) {
    readyPromise = _sodium.ready.then(() => _sodium);
  }
  return readyPromise;
}
