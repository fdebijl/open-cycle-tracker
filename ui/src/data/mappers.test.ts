import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { randomBytes } from '@/crypto/primitives';
import { encryptString } from '@/crypto';
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
    encDayType: null,
    order: 1,
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    ...overrides,
  };
}

describe('day mapper', () => {
  it('round-trips date and dayType through encrypt/decrypt', async () => {
    const date = new Date(2026, 5, 13); // 2026-06-13 local
    const enc = await encryptDayFields({ date, dayType: 'period' }, dek);
    const day = await decryptDay(baseDay({ encDate: enc.encDate, encDayType: enc.encDayType }), dek);

    expect(day.dayType).toBe('period');
    expect(format(day.date!, 'yyyy-MM-dd')).toBe('2026-06-13');
  });

  it('defaults to dayType "none" when encDayType is absent', async () => {
    const day = await decryptDay(baseDay({}), dek);
    expect(day.dayType).toBe('none');
    expect(day.date).toBeNull();
  });

  it('coerces an unknown day type to "none"', async () => {
    const day = await decryptDay(baseDay({ encDayType: await encryptString('garbage', dek) }), dek);
    expect(day.dayType).toBe('none');
  });
});

describe('factor mapper', () => {
  it('decrypts notes when present', async () => {
    const dto: FactorDto = {
      id: 'f1',
      dayId: 'd1',
      userId: 'u1',
      categoryLevelId: 'cl1',
      encNotes: await encryptString('felt tired', dek),
      createdAt: '',
      updatedAt: '',
    };
    const factor = await decryptFactor(dto, dek);
    expect(factor.notes).toBe('felt tired');
    expect(factor.categoryLevelId).toBe('cl1');
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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('settings mapper', () => {
  it('round-trips settings through encrypt/decrypt', async () => {
    const enc = await encryptSettings({ averageCycleLength: 30 }, dek);
    const settings = await decryptSettings(baseUser({ encSettings: enc }), dek);
    expect(settings.averageCycleLength).toBe(30);
  });

  it('defaults to a 28-day average when settings are absent', async () => {
    const settings = await decryptSettings(baseUser({ encSettings: null }), dek);
    expect(settings.averageCycleLength).toBe(28);
  });
});

describe('category mapper (two-tier)', () => {
  it('passes through plaintext for global categories', async () => {
    const dto: CategoryDto = {
      id: 'cat1',
      userId: null,
      global: true,
      name: 'Bleeding',
      icon: 'water',
      color: '#ff0000',
      encName: null,
      encIcon: null,
      encColor: null,
      createdAt: '',
      updatedAt: '',
    };
    const cat = await decryptCategory(dto, dek);
    expect(cat).toMatchObject({ global: true, name: 'Bleeding', icon: 'water', color: '#ff0000' });
  });

  it('decrypts encrypted fields for user categories', async () => {
    const dto: CategoryDto = {
      id: 'cat2',
      userId: 'u1',
      global: false,
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
      name: 'Heavy',
      icon: 'water',
      encName: null,
      encIcon: null,
      createdAt: '',
      updatedAt: '',
    };
    expect((await decryptCategoryLevel(userLevel, dek)).name).toBe('Strong');
    expect((await decryptCategoryLevel(globalLevel, dek)).name).toBe('Heavy');
  });
});
