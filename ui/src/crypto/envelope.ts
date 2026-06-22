import { aeadDecrypt, aeadEncrypt, moderateKdfParams, randomBytes } from './primitives';
import { deriveKey } from './kdf';
import { fromBase64, mnemonicToSecret, secretToMnemonic, toBase64 } from './codec';
import { DEK_BYTES, RECOVERY_BYTES, SALT_BYTES } from './types';
import type { KdfParams } from './types';

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
  /** The raw DEK, held in memory after signup, never persisted. */
  dek: Uint8Array;
  /** The recovery mnemonic, shown to the user exactly once. */
  recoveryMnemonic: string;
}

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

/**
 * Decoy/duress setup, built from an unlocked real session.
 *
 * The decoy vault is a *separate* (shadow) account with its own DEK and salts;
 * `shadow` is the full envelope the server stores on that row. `duressAuthHash`
 * is the verifier stored on the PRIMARY row - derived from the PRIMARY's
 * `saltAuth`/`kdfParams` so that the single authHash a client derives at login
 * (which always uses the primary's prelogin material) can match it. At a duress
 * login the server returns the shadow's `saltKek`/`wrappedDek`, and the
 * unchanged login path unwraps the decoy DEK.
 */
export interface DecoyVaultPayload {
  duressAuthHash: string;
  /** Key/envelope material for the decoy's own users row (server assigns its identifier). */
  shadow: Omit<SignupPayload, 'identifier' | 'email'>;
}

export async function createDecoyVault(
  duressPassword: string,
  primarySaltAuthB64: string,
  primaryKdfParams: KdfParams,
): Promise<DecoyVaultPayload> {
  // A complete, valid vault for the decoy: its own DEK, salts and recovery
  // wrapping. The decoy's own authHash/recovery are never exercised (login
  // always resolves the PRIMARY by identifier), but every column must be set.
  const { payload } = await createSignup('decoy', duressPassword, undefined, primaryKdfParams);

  // The server assigns the shadow's identifier; drop the placeholder one (and the
  // never-set email) so only key/envelope material is sent.
  const shadow = {
    authHash: payload.authHash,
    recoveryAuthHash: payload.recoveryAuthHash,
    saltAuth: payload.saltAuth,
    saltKek: payload.saltKek,
    saltRecovery: payload.saltRecovery,
    saltRecoveryAuth: payload.saltRecoveryAuth,
    kdfParams: payload.kdfParams,
    wrappedDek: payload.wrappedDek,
    wrappedDekRecovery: payload.wrappedDekRecovery,
  };

  const duressAuthHash = await deriveAuthHash(duressPassword, primarySaltAuthB64, primaryKdfParams);
  return { duressAuthHash, shadow };
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
  saltAuthB64: string,
  kdfParams: KdfParams,
): Promise<PasswordChangeEnvelope> {
  // Reuse the account's existing saltAuth + kdfParams so the derived authHash
  // stays comparable against any configured duress/destruct verifiers (which
  // are derived from the same saltAuth and cannot be re-derived here without
  // the duress/destruct passwords). Only the KEK wrapping rotates.
  const saltKek = await randomBytes(SALT_BYTES);

  const kek = await deriveKey(newPassword, saltKek, kdfParams);
  const wrappedDek = await aeadEncrypt(dek, kek);
  const authHash = await deriveKey(newPassword, await fromBase64(saltAuthB64), kdfParams);

  return {
    authHash: await toBase64(authHash),
    saltAuth: saltAuthB64,
    saltKek: await toBase64(saltKek),
    wrappedDek: await toBase64(wrappedDek),
    kdfParams,
  };
}
