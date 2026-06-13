/**
 * Argon2id KDF parameters. Stored per-user on the server and returned to the
 * client so they can be raised over time without breaking existing accounts.
 * Mirrors `kdfParams` in the server's encryption contract.
 */
export interface KdfParams {
  algorithm: 'argon2id';
  opsLimit: number;
  memLimit: number;
}

/** Byte lengths fixed by the encryption contract. */
export const SALT_BYTES = 16;
export const NONCE_BYTES = 24;
export const KEY_BYTES = 32;
export const DEK_BYTES = 32;
/** Recovery secret: 32 bytes → 24-word BIP39 mnemonic. */
export const RECOVERY_BYTES = 32;
