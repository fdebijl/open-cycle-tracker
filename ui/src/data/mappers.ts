import { format, parseISO } from 'date-fns';
import { decryptJson, decryptString, encryptJson, encryptString } from '@/crypto';
import type { CategoryDto, CategoryLevelDto, DayDto, FactorDto, UserDto } from '@/api/types';
import { DEFAULT_USER_SETTINGS } from './types';
import type { Category, CategoryLevel, Day, Factor, UserSettings } from './types';

/**
 * The decryption boundary. API DTOs carry opaque base64 ciphertext; these
 * functions turn them into the plaintext domain models the UI renders (and
 * back), using the in-memory DEK. Dates are stored encrypted as `yyyy-MM-dd`
 * (the tracked calendar day - no time component, no timezone ambiguity).
 */

const ISO_DATE = 'yyyy-MM-dd';

export async function decryptDay(dto: DayDto, dek: Uint8Array): Promise<Day> {
  const date = dto.encDate ? parseISO(await decryptString(dto.encDate, dek)) : null;
  const notes = dto.encNotes ? await decryptString(dto.encNotes, dek) : null;
  return { id: dto.id, cycleId: dto.cycleId, order: dto.order, date, notes };
}

export async function encryptDayFields(
  fields: { date?: Date; notes?: string | null },
  dek: Uint8Array,
): Promise<{ encDate?: string; encNotes?: string | null }> {
  const out: { encDate?: string; encNotes?: string | null } = {};
  if (fields.date !== undefined) out.encDate = await encryptString(format(fields.date, ISO_DATE), dek);
  // A null/empty note clears it (sent as null); a non-empty note is encrypted.
  if (fields.notes !== undefined) {
    out.encNotes = fields.notes ? await encryptString(fields.notes, dek) : null;
  }
  return out;
}

export async function decryptFactor(dto: FactorDto, dek: Uint8Array): Promise<Factor> {
  const notes = dto.encNotes ? await decryptString(dto.encNotes, dek) : null;
  let value: number | null = null;
  if (dto.encValue) {
    const n = Number(await decryptString(dto.encValue, dek));
    value = Number.isFinite(n) ? n : null;
  }
  return { id: dto.id, dayId: dto.dayId, categoryLevelId: dto.categoryLevelId, notes, value };
}

/** Prefer encrypted fields when present (user-owned), else the plaintext global. */
export async function decryptCategory(dto: CategoryDto, dek: Uint8Array): Promise<Category> {
  return {
    id: dto.id,
    userId: dto.userId,
    global: dto.global,
    slug: dto.slug,
    name: dto.encName ? await decryptString(dto.encName, dek) : (dto.name ?? ''),
    icon: dto.encIcon ? await decryptString(dto.encIcon, dek) : (dto.icon ?? ''),
    color: dto.encColor ? await decryptString(dto.encColor, dek) : (dto.color ?? ''),
  };
}

export async function decryptCategoryLevel(dto: CategoryLevelDto, dek: Uint8Array): Promise<CategoryLevel> {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    order: dto.order,
    name: dto.encName ? await decryptString(dto.encName, dek) : (dto.name ?? ''),
    icon: dto.encIcon ? await decryptString(dto.encIcon, dek) : (dto.icon ?? ''),
  };
}

/** Decrypt the user's settings blob, falling back to defaults when unset or
 * unparseable (a fresh account has no `encSettings` until onboarding writes it). */
export async function decryptSettings(dto: UserDto, dek: Uint8Array): Promise<UserSettings> {
  if (!dto.encSettings) return { ...DEFAULT_USER_SETTINGS };
  try {
    const parsed = await decryptJson<Partial<UserSettings>>(dto.encSettings, dek);
    return { ...DEFAULT_USER_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function encryptSettings(settings: UserSettings, dek: Uint8Array): Promise<string> {
  return encryptJson(settings, dek);
}

/** Decrypt an array, preserving order. */
export function decryptAll<D, T>(dtos: D[], dek: Uint8Array, fn: (dto: D, dek: Uint8Array) => Promise<T>): Promise<T[]> {
  return Promise.all(dtos.map((dto) => fn(dto, dek)));
}
