import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { randomBytes } from '@/crypto/primitives';
import { encryptJson, encryptString } from '@/crypto';
import {
  decryptCategory,
  decryptCategoryLevel,
  decryptDay,
  decryptFactor,
  decryptSettings,
  encryptDayFields,
  encryptSettings,
} from './mappers';
import type { CategoryDto, CategoryLevelDto, DayDto, FactorDto, UserDto } from '@/api/types';

const dek = await randomBytes(32);

function baseDay(overrides: Partial<DayDto>): DayDto {
  return {
    id: 'd1',
    cycleId: 'c1',
    userId: 'u1',
    encDate: null,
    encNotes: null,
    order: 1,
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    ...overrides,
  };
}

describe('day mapper', () => {
  it('round-trips the date through encrypt/decrypt', async () => {
    const date = new Date(2026, 5, 13); // 2026-06-13 local
    const enc = await encryptDayFields({ date }, dek);
    const day = await decryptDay(baseDay({ encDate: enc.encDate }), dek);

    expect(format(day.date!, 'yyyy-MM-dd')).toBe('2026-06-13');
  });

  it('defaults date and notes to null when absent', async () => {
    const day = await decryptDay(baseDay({}), dek);
    expect(day.date).toBeNull();
    expect(day.notes).toBeNull();
  });

  it('round-trips an optional free-text note', async () => {
    const enc = await encryptDayFields({ notes: 'slept badly, cramps' }, dek);
    const day = await decryptDay(baseDay({ encNotes: enc.encNotes }), dek);
    expect(day.notes).toBe('slept badly, cramps');
  });

  it('clears the note when given null or empty', async () => {
    expect((await encryptDayFields({ notes: null }, dek)).encNotes).toBeNull();
    expect((await encryptDayFields({ notes: '' }, dek)).encNotes).toBeNull();
  });
});

function baseFactor(overrides: Partial<FactorDto>): FactorDto {
  return {
    id: 'f1',
    dayId: 'd1',
    userId: 'u1',
    categoryLevelId: 'cl1',
    encNotes: null,
    encValue: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('factor mapper', () => {
  it('decrypts notes when present', async () => {
    const factor = await decryptFactor(baseFactor({ encNotes: await encryptString('felt tired', dek) }), dek);
    expect(factor.notes).toBe('felt tired');
    expect(factor.categoryLevelId).toBe('cl1');
    expect(factor.value).toBeNull();
  });

  it('decrypts an optional numeric reading (e.g. BBT)', async () => {
    const factor = await decryptFactor(baseFactor({ encValue: await encryptString('36.65', dek) }), dek);
    expect(factor.value).toBe(36.65);
  });

  it('falls back to null when the value is not a finite number', async () => {
    const factor = await decryptFactor(baseFactor({ encValue: await encryptString('not-a-number', dek) }), dek);
    expect(factor.value).toBeNull();
  });
});

function baseUser(overrides: Partial<UserDto>): UserDto {
  return {
    id: 'u1',
    identifier: 'alice',
    email: null,
    isAdmin: false,
    encName: null,
    encInfo: null,
    encSettings: null,
    duressConfigured: false,
    destructConfigured: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('settings mapper', () => {
  it('round-trips settings through encrypt/decrypt', async () => {
    const enc = await encryptSettings(
      {
        averageCycleLength: 30,
        autoLockMs: 15 * 60 * 1000,
        lockOnHidden: false,
        markers: { menstruation: false, fertile: true, ovulation: false, pms: true },
      },
      dek,
    );
    const settings = await decryptSettings(baseUser({ encSettings: enc }), dek);
    expect(settings.averageCycleLength).toBe(30);
    expect(settings.autoLockMs).toBe(15 * 60 * 1000);
    expect(settings.lockOnHidden).toBe(false);
    expect(settings.markers).toEqual({ menstruation: false, fertile: true, ovulation: false, pms: true });
  });

  it('falls back to defaults when settings are absent', async () => {
    const settings = await decryptSettings(baseUser({ encSettings: null }), dek);
    expect(settings.averageCycleLength).toBe(28);
    expect(settings.autoLockMs).toBe(5 * 60 * 1000);
    expect(settings.lockOnHidden).toBe(true);
    // Menstruation/fertile/ovulation default on; PMS off.
    expect(settings.markers).toEqual({ menstruation: true, fertile: true, ovulation: true, pms: false });
  });

  it('fills missing fields from defaults for older settings blobs', async () => {
    // A blob written before auto-lock/marker settings existed has only averageCycleLength.
    const enc = await encryptJson({ averageCycleLength: 21 }, dek);
    const settings = await decryptSettings(baseUser({ encSettings: enc }), dek);
    expect(settings.averageCycleLength).toBe(21);
    expect(settings.autoLockMs).toBe(5 * 60 * 1000);
    expect(settings.lockOnHidden).toBe(true);
    expect(settings.markers).toEqual({ menstruation: true, fertile: true, ovulation: true, pms: false });
  });

  it('deep-merges a partial markers object from defaults', async () => {
    // A blob that set only the PMS toggle should keep the other markers at their defaults.
    const enc = await encryptJson({ averageCycleLength: 28, markers: { pms: true } }, dek);
    const settings = await decryptSettings(baseUser({ encSettings: enc }), dek);
    expect(settings.markers).toEqual({ menstruation: true, fertile: true, ovulation: true, pms: true });
  });
});

describe('category mapper (two-tier)', () => {
  it('passes through plaintext for global categories', async () => {
    const dto: CategoryDto = {
      id: 'cat1',
      userId: null,
      global: true,
      slug: 'flow',
      name: 'Flow',
      icon: 'water',
      color: '#e76666',
      encName: null,
      encIcon: null,
      encColor: null,
      createdAt: '',
      updatedAt: '',
    };
    const cat = await decryptCategory(dto, dek);
    expect(cat).toMatchObject({ global: true, slug: 'flow', name: 'Flow', icon: 'water', color: '#e76666' });
  });

  it('decrypts encrypted fields for user categories', async () => {
    const dto: CategoryDto = {
      id: 'cat2',
      userId: 'u1',
      global: false,
      slug: null,
      name: null,
      icon: null,
      color: null,
      encName: await encryptString('Cravings', dek),
      encIcon: await encryptString('food-apple', dek),
      encColor: await encryptString('#00ff00', dek),
      createdAt: '',
      updatedAt: '',
    };
    const cat = await decryptCategory(dto, dek);
    expect(cat).toMatchObject({ global: false, name: 'Cravings', icon: 'food-apple', color: '#00ff00' });
  });
});

describe('category level mapper', () => {
  it('decrypts user level names and falls back to plaintext for globals', async () => {
    const userLevel: CategoryLevelDto = {
      id: 'l1',
      categoryId: 'cat2',
      order: null,
      name: null,
      icon: null,
      encName: await encryptString('Strong', dek),
      encIcon: null,
      createdAt: '',
      updatedAt: '',
    };
    const globalLevel: CategoryLevelDto = {
      id: 'l2',
      categoryId: 'cat1',
      order: 3,
      name: 'Heavy',
      icon: 'water',
      encName: null,
      encIcon: null,
      createdAt: '',
      updatedAt: '',
    };
    expect((await decryptCategoryLevel(userLevel, dek)).name).toBe('Strong');
    const heavy = await decryptCategoryLevel(globalLevel, dek);
    expect(heavy.name).toBe('Heavy');
    expect(heavy.order).toBe(3);
  });
});
