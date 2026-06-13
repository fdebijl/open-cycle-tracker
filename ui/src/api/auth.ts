import type { PasswordChangeEnvelope, SignupPayload } from '@/crypto/envelope';
import type { KdfParams } from '@/crypto/types';
import { api } from './client';
import type { AuthResult, PreloginResult } from './types';

/** Step 1 of login: fetch the KDF salt + params for an identifier. Returns an
 * anti-enumeration pseudo-salt for unknown identifiers. */
export function prelogin(identifier: string): Promise<PreloginResult> {
  return api.post<PreloginResult>('/auth/prelogin', { identifier });
}

/** Step 2 of login: submit the derived authHash verifier. */
export function login(identifier: string, authHash: string): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/login', { identifier, authHash });
}

export function signup(payload: SignupPayload): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/signup', payload);
}

/** Revoke the current token server-side (jti denylist). */
export function logout(): Promise<void> {
  return api.del<void>('/auth/logout');
}

/** Change password (authenticated): submit re-wrapped auth/KEK material. */
export function changePassword(body: PasswordChangeEnvelope): Promise<void> {
  return api.post<void>('/auth/password', body);
}

export interface RecoverInitResult {
  saltRecovery: string;
  saltRecoveryAuth: string;
  wrappedDekRecovery: string;
  kdfParams: KdfParams;
}

/** Step 1 of recovery: fetch the recovery wrapping material by identifier. */
export function recoverInit(identifier: string): Promise<RecoverInitResult> {
  return api.post<RecoverInitResult>('/auth/recover/init', { identifier });
}

export type RecoverBody = PasswordChangeEnvelope & { identifier: string; recoveryAuthHash: string };

/** Step 2 of recovery: prove the recovery code + set new password. */
export function recover(body: RecoverBody): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/recover', body);
}
