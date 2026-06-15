import type { KdfParams } from '@/crypto/types';

/**
 * DTOs mirroring the Node API's plain-JSON responses. Encrypted fields are
 * base64 strings of opaque ciphertext (`nonce || ct+tag`); the client decrypts
 * them in the data layer. Kept isolated here so API contract drift is a
 * single-file change.
 */

export interface AuthUser {
  id: string;
  identifier: string;
  email: string | null;
}

/** Response of `POST /auth/login` and `POST /auth/signup`. */
export interface AuthResult {
  token: string;
  user: AuthUser;
  /** The account's login salt (stable across password changes); used to re-derive
   * the authHash on a password change so duress/destruct verifiers survive. */
  saltAuth: string;
  saltKek: string;
  wrappedDek: string;
  kdfParams: KdfParams;
}

/** Response of `POST /auth/prelogin`. */
export interface PreloginResult {
  saltAuth: string;
  kdfParams: KdfParams;
}

export interface UserDto {
  id: string;
  identifier: string;
  email: string | null;
  isAdmin: boolean;
  encName: string | null;
  encInfo: string | null;
  encSettings: string | null;
  /** Whether a duress (decoy) / destruction password is configured (roadmap #14). */
  duressConfigured: boolean;
  destructConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CycleDto {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactorDto {
  id: string;
  dayId: string;
  userId: string;
  categoryLevelId: string;
  encNotes: string | null;
  /** Optional encrypted numeric reading (e.g. BBT). */
  encValue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayDto {
  id: string;
  cycleId: string;
  userId: string;
  encDate: string | null;
  encNotes: string | null;
  order: number | null;
  createdAt: string;
  updatedAt: string;
  /** Present only on `GET /days/:id`. */
  factors?: FactorDto[];
}

export interface CategoryDto {
  id: string;
  userId: string | null;
  global: boolean;
  /** Stable identifier on global categories (e.g. `flow`, `bbt`); null otherwise. */
  slug: string | null;
  name: string | null;
  icon: string | null;
  color: string | null;
  encName: string | null;
  encIcon: string | null;
  encColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryLevelDto {
  id: string;
  categoryId: string;
  /** Ordinal position within the category (0-based); null where unordered. */
  order: number | null;
  name: string | null;
  icon: string | null;
  encName: string | null;
  encIcon: string | null;
  createdAt: string;
  updatedAt: string;
}
