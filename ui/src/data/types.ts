/** Decrypted domain models the UI renders. Mirrors the old Ember models, with
 * the encrypted fields resolved to plaintext in `mappers.ts`. */

export interface Cycle {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A tracked day. There is no manual "phase" on a day: the period signal is
 * derived from the ordinal `flow` category (a Flow factor ≥ Light marks a period
 * day), and fertile/ovulation are a computed, non-persisted forecast shown in the
 * cycle overview - not something the user can self-report accurately.
 */
export interface Day {
  id: string;
  cycleId: string;
  order: number | null;
  date: Date | null;
  /** Optional free-text journal note for the day. */
  notes: string | null;
}

export interface Factor {
  id: string;
  dayId: string;
  categoryLevelId: string;
  notes: string | null;
  /** Optional numeric reading (e.g. BBT temperature); null for plain factors. */
  value: number | null;
}

export interface Category {
  id: string;
  userId: string | null;
  global: boolean;
  /** Stable identifier on global categories (e.g. `flow`, `bbt`); null otherwise. */
  slug: string | null;
  name: string;
  icon: string;
  color: string;
}

export interface CategoryLevel {
  id: string;
  categoryId: string;
  /** Ordinal position within the category (0-based); null where unordered. */
  order: number | null;
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
