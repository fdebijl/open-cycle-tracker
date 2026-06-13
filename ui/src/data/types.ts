/** Decrypted domain models the UI renders. Mirrors the old Ember models, with
 * the encrypted fields resolved to plaintext in `mappers.ts`. */

export type DayType = 'none' | 'period' | 'fertile' | 'ovulation' | 'pms';

export const DAY_TYPES: DayType[] = ['none', 'period', 'fertile', 'ovulation', 'pms'];

export interface Cycle {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Day {
  id: string;
  cycleId: string;
  order: number | null;
  date: Date | null;
  dayType: DayType;
}

export interface Factor {
  id: string;
  dayId: string;
  categoryLevelId: string;
  notes: string | null;
}

export interface Category {
  id: string;
  userId: string | null;
  global: boolean;
  name: string;
  icon: string;
  color: string;
}

export interface CategoryLevel {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
}

/** Per-user preferences, stored end-to-end encrypted in `users.encSettings`. */
export interface UserSettings {
  /** Typical cycle length in days; seeds the next-period estimate and the cycle
   * circle's slot count until real history accumulates. */
  averageCycleLength: number;
}

/** The default cycle length offered at onboarding and assumed when a user has
 * no stored settings yet. */
export const DEFAULT_AVERAGE_CYCLE_LENGTH = 28;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  averageCycleLength: DEFAULT_AVERAGE_CYCLE_LENGTH,
};
