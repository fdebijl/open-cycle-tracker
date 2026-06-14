import { aeadDecrypt, aeadEncrypt, moderateKdfParams, randomBytes } from './primitives';
import { deriveKey } from './kdf';
import { fromBase64, mnemonicToSecret, secretToMnemonic, toBase64 } from './codec';
import { DEK_BYTES, RECOVERY_BYTES, SALT_BYTES } from './types';
import type { KdfParams } from './types';

/**
 * The crypto envelope: signup key generation, login DEK unwrap, recovery, and
 * password change. Implements the client side of `for_claude/encryption.md`.
 * The server stores only the base64 values produced here and can decrypt none
 * of them.
 */

/** Exact request body for `POST /auth/signup`. */
export interface SignupPayload {
  identifier: string;
  email?: string;
  authHash: string;
  recoveryAuthHash: string;
  saltAuth: string;
  saltKek: string;
  saltRecovery: string;
  saltRecoveryAuth: string;
  kdfParams: KdfParams;
  wrappedDek: string;
  wrappedDekRecovery: string;
}

export interface SignupResult {
  payload: SignupPayload;
  /** The raw DEK - held in memory after signup, never persisted. */
  dek: Uint8Array;
  /** The recovery mnemonic - shown to the user exactly once. */
  recoveryMnemonic: string;
}

/** Build the full signup envelope locally. The password never leaves the client. */
export async function createSignup(
  identifier: string,
  password: string,
  email?: string,
  kdfParams?: KdfParams,
): Promise<SignupResult> {
  const params = kdfParams ?? (await moderateKdfParams());

  const dek = await randomBytes(DEK_BYTES);
  const saltAuth = await randomBytes(SALT_BYTES);
  const saltKek = await randomBytes(SALT_BYTES);
  const saltRecovery = await randomBytes(SALT_BYTES);
  const saltRecoveryAuth = await randomBytes(SALT_BYTES);
  const recoverySecret = await randomBytes(RECOVERY_BYTES);
  // The recovery code is the base64 of the secret - this string is the KDF
  // input (matching the API's reference client), while the user sees the BIP39
  // mnemonic of the same bytes. The two encode the identical secret.
  const recoveryCode = await toBase64(recoverySecret);

  const kek = await deriveKey(password, saltKek, params);
  const wrappedDek = await aeadEncrypt(dek, kek);

  const recoveryKek = await deriveKey(recoveryCode, saltRecovery, params);
  const wrappedDekRecovery = await aeadEncrypt(dek, recoveryKek);

  const authHash = await deriveKey(password, saltAuth, params);
  const recoveryAuthHash = await deriveKey(recoveryCode, saltRecoveryAuth, params);

  return {
    payload: {
      identifier,
      ...(email ? { email } : {}),
      authHash: await toBase64(authHash),
      recoveryAuthHash: await toBase64(recoveryAuthHash),
      saltAuth: await toBase64(saltAuth),
      saltKek: await toBase64(saltKek),
      saltRecovery: await toBase64(saltRecovery),
      saltRecoveryAuth: await toBase64(saltRecoveryAuth),
      kdfParams: params,
      wrappedDek: await toBase64(wrappedDek),
      wrappedDekRecovery: await toBase64(wrappedDekRecovery),
    },
    dek,
    recoveryMnemonic: secretToMnemonic(recoverySecret),
  };
}

/** Step 2 of login: derive the authHash verifier the server checks. */
export async function deriveAuthHash(password: string, saltAuthB64: string, params: KdfParams): Promise<string> {
  const salt = await fromBase64(saltAuthB64);
  return toBase64(await deriveKey(password, salt, params));
}

/** After a successful login, unwrap the DEK from the password-derived KEK. */
export async function unwrapDek(
  password: string,
  saltKekB64: string,
  wrappedDekB64: string,
  params: KdfParams,
): Promise<Uint8Array> {
  const salt = await fromBase64(saltKekB64);
  const kek = await deriveKey(password, salt, params);
  return aeadDecrypt(await fromBase64(wrappedDekB64), kek);
}

/** Turn a recovery mnemonic back into the base64 recovery code (KDF input). */
export async function mnemonicToRecoveryCode(mnemonic: string): Promise<string> {
  return toBase64(mnemonicToSecret(mnemonic));
}

/** Recover the DEK from the recovery code when the password is forgotten. */
export async function recoverDek(
  recoveryCode: string,
  saltRecoveryB64: string,
  wrappedDekRecoveryB64: string,
  params: KdfParams,
): Promise<Uint8Array> {
  const salt = await fromBase64(saltRecoveryB64);
  const recoveryKek = await deriveKey(recoveryCode, salt, params);
  return aeadDecrypt(await fromBase64(wrappedDekRecoveryB64), recoveryKek);
}

/** Derive the recovery auth verifier (base64) sent to `POST /auth/recover`. */
export async function deriveRecoveryAuthHash(
  recoveryCode: string,
  saltRecoveryAuthB64: string,
  params: KdfParams,
): Promise<string> {
  const salt = await fromBase64(saltRecoveryAuthB64);
  return toBase64(await deriveKey(recoveryCode, salt, params));
}

/** New auth/KEK material for a password change. The DEK itself is untouched, so
 * existing data and the recovery wrapping remain valid. */
export interface PasswordChangeEnvelope {
  authHash: string;
  saltAuth: string;
  saltKek: string;
  wrappedDek: string;
  kdfParams: KdfParams;
}

export async function rewrapForPasswordChange(
  dek: Uint8Array,
  newPassword: string,
  kdfParams?: KdfParams,
): Promise<PasswordChangeEnvelope> {
  const params = kdfParams ?? (await moderateKdfParams());
  const saltAuth = await randomBytes(SALT_BYTES);
  const saltKek = await randomBytes(SALT_BYTES);

  const kek = await deriveKey(newPassword, saltKek, params);
  const wrappedDek = await aeadEncrypt(dek, kek);
  const authHash = await deriveKey(newPassword, saltAuth, params);

  return {
    authHash: await toBase64(authHash),
    saltAuth: await toBase64(saltAuth),
    saltKek: await toBase64(saltKek),
    wrappedDek: await toBase64(wrappedDek),
    kdfParams: params,
  };
}
