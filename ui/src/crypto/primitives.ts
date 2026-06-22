import { getSodium } from './sodium';
import { KEY_BYTES } from './types';
import type { KdfParams } from './types';

/**
 * Derive a key from a password and salt, using argon2id.
 *
 * Callers SHOULD go through the worker-backed `deriveKey` in `kdf.ts` rather than
 * calling this directly on the main thread, which could slow down the UI.
 * Accepts a string password (NFC normalized for cross-platform stability) or raw bytes (e.g. the recovery secret).
 */
export async function deriveKeyRaw(
  password: string | Uint8Array,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  const sodium = await getSodium();

  if (params.algorithm !== 'argon2id') {
    throw new Error(`Unsupported KDF algorithm: ${params.algorithm}`);
  }

  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error(`Invalid salt length: expected ${sodium.crypto_pwhash_SALTBYTES}, got ${salt.length}`);
  }

  const pw = typeof password === 'string' ? password.normalize('NFC') : password;

  return sodium.crypto_pwhash(
    KEY_BYTES,
    pw,
    salt,
    params.opsLimit,
    params.memLimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** Encrypt a plaintext byte array with a given key, using XChaCha20-Poly1305 AEAD encryption. */
export async function aeadEncrypt(plaintext: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, null, null, nonce, key);
  const blob = new Uint8Array(nonce.length + ciphertext.length);
  blob.set(nonce, 0);
  blob.set(ciphertext, nonce.length);
  return blob;
}

/** Decrypt a blob with a given key */
export async function aeadDecrypt(blob: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const n = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  if (blob.length < n) throw new Error('Ciphertext blob too short to contain a nonce');
  const nonce = blob.subarray(0, n);
  const ciphertext = blob.subarray(n);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
}

export async function randomBytes(length: number): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(length);
}

export async function moderateKdfParams(): Promise<KdfParams> {
  const sodium = await getSodium();
  return {
    algorithm: 'argon2id',
    opsLimit: sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    memLimit: sodium.crypto_pwhash_MEMLIMIT_MODERATE,
  };
}

/** Lighter KDF params, used only by tests for speed */
export async function interactiveKdfParams(): Promise<KdfParams> {
  const sodium = await getSodium();
  return {
    algorithm: 'argon2id',
    opsLimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memLimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}
