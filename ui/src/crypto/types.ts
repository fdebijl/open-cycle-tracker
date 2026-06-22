/**
 * Argon2id KDF parameters. Stored per-user on the server and returned to the
 * client so they can be raised over time without breaking existing accounts.
 * Must mirror `kdfParams` in the server's encryption contract.
 */
export interface KdfParams {
  /** Must be argon2id in OCT */
  algorithm: 'argon2id';
  /** The maximum amount of computations to perform. Raising this number will make the function require more CPU cycles to compute a key. Higher numbers are more resistant to brute forcing, but will slow down legitimate auth actions by the user as well. */
  opsLimit: number;
  /** The maximum amount of RAM in bytes that the function will use. Higher numbers are more resistant to brute forcing, but will slow down legitimate auth actions by the user as well. */
  memLimit: number;
}

export const SALT_BYTES = 16;
export const KEY_BYTES = 32;
export const DEK_BYTES = 32;
export const RECOVERY_BYTES = 32;
