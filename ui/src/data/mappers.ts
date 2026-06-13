import { format, parseISO } from 'date-fns';
import { decryptString, encryptString } from '@/crypto';
import type { CategoryDto, CategoryLevelDto, DayDto, FactorDto } from '@/api/types';
import { DAY_TYPES } from './types';
import type { Category, CategoryLevel, Day, DayType, Factor } from './types';

/**
 * The decryption boundary. API DTOs carry opaque base64 ciphertext; these
 * functions turn them into the plaintext domain models the UI renders (and
 * back), using the in-memory DEK. Dates are stored encrypted as `yyyy-MM-dd`
 * (the tracked calendar day — no time component, no timezone ambiguity).
 */

const ISO_DATE = 'yyyy-MM-dd';

function coerceDayType(value: string): DayType {
  return (DAY_TYPES as string[]).includes(value) ? (value as DayType) : 'none';
}

export async function decryptDay(dto: DayDto, dek: Uint8Array): Promise<Day> {
  const date = dto.encDate ? parseISO(await decryptString(dto.encDate, dek)) : null;
  const dayType = dto.encDayType ? coerceDayType(await decryptString(dto.encDayType, dek)) : 'none';
  return { id: dto.id, cycleId: dto.cycleId, order: dto.order, date, dayType };
}

export async function encryptDayFields(
  fields: { date?: Date; dayType?: DayType },
  dek: Uint8Array,
): Promise<{ encDate?: string; encDayType?: string }> {
  const out: { encDate?: string; encDayType?: string } = {};
  if (fields.date !== undefined) out.encDate = await encryptString(format(fields.date, ISO_DATE), dek);
  if (fields.dayType !== undefined) out.encDayType = await encryptString(fields.dayType, dek);
  return out;
}

export async function decryptFactor(dto: FactorDto, dek: Uint8Array): Promise<Factor> {
  const notes = dto.encNotes ? await decryptString(dto.encNotes, dek) : null;
  return { id: dto.id, dayId: dto.dayId, categoryLevelId: dto.categoryLevelId, notes };
}

/** Prefer encrypted fields when present (user-owned), else the plaintext global. */
export async function decryptCategory(dto: CategoryDto, dek: Uint8Array): Promise<Category> {
  return {
    id: dto.id,
    userId: dto.userId,
    global: dto.global,
    name: dto.encName ? await decryptString(dto.encName, dek) : (dto.name ?? ''),
    icon: dto.encIcon ? await decryptString(dto.encIcon, dek) : (dto.icon ?? ''),
    color: dto.encColor ? await decryptString(dto.encColor, dek) : (dto.color ?? ''),
  };
}

export async function decryptCategoryLevel(dto: CategoryLevelDto, dek: Uint8Array): Promise<CategoryLevel> {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    name: dto.encName ? await decryptString(dto.encName, dek) : (dto.name ?? ''),
    icon: dto.encIcon ? await decryptString(dto.encIcon, dek) : (dto.icon ?? ''),
  };
}

/** Decrypt an array, preserving order. */
export function decryptAll<D, T>(dtos: D[], dek: Uint8Array, fn: (dto: D, dek: Uint8Array) => Promise<T>): Promise<T[]> {
  return Promise.all(dtos.map((dto) => fn(dto, dek)));
}
