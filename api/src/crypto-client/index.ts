/**
 * REFERENCE CLIENT-SIDE CRYPTO.
 *
 * This is the canonical implementation of the encryption contract in
 * docs/encryption.md. It runs on the CLIENT (browser/native), NOT on the
 * server — the API never imports it at runtime. It lives in this repo so that:
 *   1. it is the single source of truth a web/native client can copy or share,
 *   2. the test suite can prove the envelope round-trips and that the payload
 *      sent to the server contains no plaintext.
 *
 * Everything here uses libsodium (`libsodium-wrappers`).
 */
import _sodium from 'libsodium-wrappers-sumo';

export type KdfParams = {
  algorithm: 'argon2id';
  opsLimit: number;
  memLimit: number;
};

export type Sodium = typeof _sodium;

let sodium: Sodium | null = null;

/** Must be awaited once before using any other function here. */
export async function ready(): Promise<Sodium> {
  if (!sodium) {
    await _sodium.ready;
    sodium = _sodium;
  }
  return sodium;
}

function s(): Sodium {
  if (!sodium) throw new Error('crypto-client not initialized: await ready() first');
  return sodium;
}

const b64 = (bytes: Uint8Array): string => s().to_base64(bytes, _sodium.base64_variants.ORIGINAL);
const unb64 = (str: string): Uint8Array => s().from_base64(str, _sodium.base64_variants.ORIGINAL);

/** Default KDF parameters. Production clients should prefer MODERATE limits. */
export function interactiveParams(): KdfParams {
  return {
    algorithm: 'argon2id',
    opsLimit: s().crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memLimit: s().crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}

export function randomBytes(len: number): Uint8Array {
  return s().randombytes_buf(len);
}

export function randomSalt(): Uint8Array {
  return s().randombytes_buf(s().crypto_pwhash_SALTBYTES);
}

/** Argon2id derivation of a `length`-byte key from a UTF-8 password + salt. */
export function deriveKey(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
  length = 32,
): Uint8Array {
  return s().crypto_pwhash(
    length,
    password,
    salt,
    params.opsLimit,
    params.memLimit,
    s().crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** Encrypt `plaintext` under `key`, returning a `nonce || ciphertext` blob. */
export function seal(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = s().randombytes_buf(s().crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ct = s().crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, null, null, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

/** Open a `nonce || ciphertext` blob with `key`. Throws if auth fails. */
export function open(blob: Uint8Array, key: Uint8Array): Uint8Array {
  const nlen = s().crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = blob.subarray(0, nlen);
  const ct = blob.subarray(nlen);
  return s().crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, null, nonce, key);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Encrypt a string field with the DEK; returns base64 for transport. */
export function encryptField(plaintext: string, dek: Uint8Array): string {
  return b64(seal(enc.encode(plaintext), dek));
}

/** Decrypt a base64 field blob with the DEK back to a string. */
export function decryptField(blobB64: string, dek: Uint8Array): string {
  return dec.decode(open(unb64(blobB64), dek));
}

export type SignupEnvelope = {
  /** Payload to POST to /auth/signup (all base64 where binary). */
  payload: {
    authHash: string;
    saltAuth: string;
    saltKek: string;
    saltRecovery: string;
    kdfParams: KdfParams;
    wrappedDek: string;
    wrappedDekRecovery: string;
  };
  /** Kept in memory by the client only. */
  dek: Uint8Array;
  /** Shown to the user once, then discarded. */
  recoveryCode: string;
};

/** Build the full signup envelope from a password (client-side). */
export function buildSignupEnvelope(
  password: string,
  params = interactiveParams(),
): SignupEnvelope {
  const dek = randomBytes(32);
  const saltAuth = randomSalt();
  const saltKek = randomSalt();
  const saltRecovery = randomSalt();
  const recoveryCodeBytes = randomBytes(32);

  const kek = deriveKey(password, saltKek, params);
  const recoveryKek = deriveKey(b64(recoveryCodeBytes), saltRecovery, params);
  const authHash = deriveKey(password, saltAuth, params);

  return {
    payload: {
      authHash: b64(authHash),
      saltAuth: b64(saltAuth),
      saltKek: b64(saltKek),
      saltRecovery: b64(saltRecovery),
      kdfParams: params,
      wrappedDek: b64(seal(dek, kek)),
      wrappedDekRecovery: b64(seal(dek, recoveryKek)),
    },
    dek,
    recoveryCode: b64(recoveryCodeBytes),
  };
}

/** Derive the login authHash (base64) the client sends to /auth/login. */
export function deriveAuthHash(password: string, saltAuthB64: string, params: KdfParams): string {
  return b64(deriveKey(password, unb64(saltAuthB64), params));
}

/** Recover the DEK after login from the server-returned material. */
export function unwrapDek(
  password: string,
  saltKekB64: string,
  wrappedDekB64: string,
  params: KdfParams,
): Uint8Array {
  const kek = deriveKey(password, unb64(saltKekB64), params);
  return open(unb64(wrappedDekB64), kek);
}

/** Recover the DEK from a recovery code (forgotten-password flow). */
export function unwrapDekWithRecovery(
  recoveryCode: string,
  saltRecoveryB64: string,
  wrappedDekRecoveryB64: string,
  params: KdfParams,
): Uint8Array {
  const recoveryKek = deriveKey(recoveryCode, unb64(saltRecoveryB64), params);
  return open(unb64(wrappedDekRecoveryB64), recoveryKek);
}

export const _internal = { b64, unb64 };
