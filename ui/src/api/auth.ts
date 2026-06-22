import type { DecoyVaultPayload, PasswordChangeEnvelope, SignupPayload } from '@/crypto/envelope';
import type { KdfParams } from '@/crypto/types';
import { api } from './client';
import type { AuthResult, PreloginResult } from './types';

export function prelogin(identifier: string): Promise<PreloginResult> {
  return api.post<PreloginResult>('/auth/prelogin', { identifier });
}

export function login(identifier: string, authHash: string): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/login', { identifier, authHash });
}

export function signup(payload: SignupPayload): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/signup', payload);
}

export function logout(): Promise<void> {
  return api.del<void>('/auth/logout');
}

export function changePassword(body: PasswordChangeEnvelope): Promise<void> {
  return api.post<void>('/auth/password', body);
}

export interface RecoverInitResult {
  saltAuth: string;
  saltRecovery: string;
  saltRecoveryAuth: string;
  wrappedDekRecovery: string;
  kdfParams: KdfParams;
}

export function recoverInit(identifier: string): Promise<RecoverInitResult> {
  return api.post<RecoverInitResult>('/auth/recover/init', { identifier });
}

export type RecoverBody = PasswordChangeEnvelope & { identifier: string; recoveryAuthHash: string };

export function recover(body: RecoverBody): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/recover', body);
}

export interface DuressConfigBody {
  duress?: DecoyVaultPayload | null;
  destructAuthHash?: string | null;
}

export function configureDuress(body: DuressConfigBody): Promise<void> {
  return api.post<void>('/auth/duress', body);
}
