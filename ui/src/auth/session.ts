import {
  createDecoyVault,
  createSignup,
  deriveAuthHash,
  deriveRecoveryAuthHash,
  mnemonicToRecoveryCode,
  recoverDek,
  rewrapForPasswordChange,
  unwrapDek,
} from '@/crypto/envelope';
import {
  changePassword as apiChangePassword,
  configureDuress as apiConfigureDuress,
  login as apiLogin,
  logout as apiLogout,
  prelogin,
  recover as apiRecover,
  recoverInit,
  signup as apiSignup,
} from '@/api/auth';
import { usersApi } from '@/api/resources';
import { useVault } from '@/stores/vault';
import type { Session } from '@/stores/vault';
import type { AuthResult } from '@/api/types';

/**
 * High-level auth flows that compose crypto + API + vault, so the UI screens
 * stay thin. Every password-derived computation happens here on the client; the
 * server only ever sees the authHash verifier and opaque wrapped keys.
 */

function sessionFromAuth(result: AuthResult): Session {
  return {
    token: result.token,
    user: result.user,
    saltAuth: result.saltAuth,
    saltKek: result.saltKek,
    wrappedDek: result.wrappedDek,
    kdfParams: result.kdfParams,
  };
}

export interface RegisterInput {
  identifier: string;
  password: string;
  email?: string;
}

/** Create the account locally, send the envelope, and unlock. Returns the
 * one-time recovery mnemonic for the caller to display exactly once. */
export async function registerAccount(input: RegisterInput): Promise<{ recoveryMnemonic: string }> {
  const { payload, dek, recoveryMnemonic } = await createSignup(input.identifier, input.password, input.email);
  const result = await apiSignup(payload);
  // We already hold the DEK we generated; no need to unwrap what we just sent.
  useVault.getState().setSession(sessionFromAuth(result), dek);
  return { recoveryMnemonic };
}

export interface LoginInput {
  identifier: string;
  password: string;
}

/** prelogin → derive authHash → login → unwrap DEK → unlock. */
export async function loginAccount(input: LoginInput): Promise<void> {
  const pre = await prelogin(input.identifier);
  const authHash = await deriveAuthHash(input.password, pre.saltAuth, pre.kdfParams);
  const result = await apiLogin(input.identifier, authHash);
  const dek = await unwrapDek(input.password, result.saltKek, result.wrappedDek, result.kdfParams);
  useVault.getState().setSession(sessionFromAuth(result), dek);
}

/** Re-derive the DEK from the password after an auto-lock (session still held). */
export async function unlockWithPassword(password: string): Promise<void> {
  const { session } = useVault.getState();
  if (!session) throw new Error('No active session to unlock');
  const dek = await unwrapDek(password, session.saltKek, session.wrappedDek, session.kdfParams);
  useVault.getState().setDek(dek);
}

export interface RecoverInput {
  identifier: string;
  mnemonic: string;
  newPassword: string;
}

/**
 * Recover access after a forgotten password using the recovery mnemonic:
 * fetch the recovery wrapping material, unwrap the DEK with the recovery code,
 * re-wrap it under a new password, and prove knowledge of the recovery code to
 * the server (recoveryAuthHash) to commit the new auth material. Leaves the
 * user logged in and unlocked.
 */
export async function recoverAccount(input: RecoverInput): Promise<void> {
  const init = await recoverInit(input.identifier);
  const recoveryCode = await mnemonicToRecoveryCode(input.mnemonic);

  // Unwrap the DEK from the recovery code (throws on a wrong/garbled mnemonic,
  // or for an unknown identifier's pseudo material).
  const dek = await recoverDek(recoveryCode, init.saltRecovery, init.wrappedDekRecovery, init.kdfParams);

  const recoveryAuthHash = await deriveRecoveryAuthHash(recoveryCode, init.saltRecoveryAuth, init.kdfParams);
  const envelope = await rewrapForPasswordChange(dek, input.newPassword, init.saltAuth, init.kdfParams);

  const result = await apiRecover({ identifier: input.identifier, recoveryAuthHash, ...envelope });
  useVault.getState().setSession(sessionFromAuth(result), dek);
}

/**
 * Change the password while logged in. Verifies the current password locally
 * (it must unwrap the existing DEK), then re-wraps the in-memory DEK under the
 * new password and submits the new auth material.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { session, dek } = useVault.getState();
  if (!session || !dek) throw new Error('Not unlocked');

  // Prove knowledge of the current password (defends an unlocked session from a
  // bystander silently changing it). Throws if the password is wrong.
  await unwrapDek(currentPassword, session.saltKek, session.wrappedDek, session.kdfParams);

  // Reuse the account's saltAuth + kdfParams so any duress/destruct verifiers
  // (derived from the same saltAuth) keep matching after the change.
  const envelope = await rewrapForPasswordChange(dek, newPassword, session.saltAuth, session.kdfParams);
  await apiChangePassword(envelope);
  useVault.getState().updateSessionKeyMaterial({
    saltKek: envelope.saltKek,
    wrappedDek: envelope.wrappedDek,
    kdfParams: envelope.kdfParams,
  });
}

/**
 * Configure the duress (decoy-vault) password. Built from the unlocked real
 * session: a fresh decoy vault + a verifier derived from the account's saltAuth.
 * The decoy is reachable by logging in with `duressPassword` and is populated by
 * using the app while in that session.
 */
export async function setDuressPassword(duressPassword: string): Promise<void> {
  const { session } = useVault.getState();
  if (!session) throw new Error('No active session');
  const duress = await createDecoyVault(duressPassword, session.saltAuth, session.kdfParams);
  await apiConfigureDuress({ duress });
}

/** Set (or replace) the destruction password verifier. Entering this password at
 * login silently wipes the account. Stores only a verifier - no vault. */
export async function setDestructPassword(destructPassword: string): Promise<void> {
  const { session } = useVault.getState();
  if (!session) throw new Error('No active session');
  const destructAuthHash = await deriveAuthHash(destructPassword, session.saltAuth, session.kdfParams);
  await apiConfigureDuress({ destructAuthHash });
}

/** Remove the duress (decoy) password and delete the decoy vault's data. */
export async function clearDuressPassword(): Promise<void> {
  await apiConfigureDuress({ duress: null });
}

/** Remove the destruction password. */
export async function clearDestructPassword(): Promise<void> {
  await apiConfigureDuress({ destructAuthHash: null });
}

/** Revoke the token server-side (best-effort), then wipe local state regardless. */
export async function logoutAccount(): Promise<void> {
  try {
    await apiLogout();
  } catch {
    // Even if the network call fails, we still drop the in-memory session.
  }
  useVault.getState().logout();
}

/** Permanently delete the account (cascades server-side), then wipe local state. */
export async function deleteAccount(): Promise<void> {
  const { session } = useVault.getState();
  if (session) await usersApi.remove(session.user.id);
  useVault.getState().logout();
}
