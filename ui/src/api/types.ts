import type { KdfParams } from '@/crypto/types';

export interface AuthUser {
  id: string;
  identifier: string;
  email: string | null;
}

/** Response of `POST /auth/login` and `POST /auth/signup`. */
export interface AuthResult {
  token: string;
  user: AuthUser;
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
  factors?: FactorDto[];
}

export interface CategoryDto {
  id: string;
  userId: string | null;
  global: boolean;
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
  order: number | null;
  name: string | null;
  icon: string | null;
  encName: string | null;
  encIcon: string | null;
  createdAt: string;
  updatedAt: string;
}
