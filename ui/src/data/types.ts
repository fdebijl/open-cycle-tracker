/** Decrypted domain models the UI renders. Mirrors the old Ember models, with
 * the encrypted fields resolved to plaintext in `mappers.ts`. */

import { AUTO_LOCK_MS } from '@/config/env';

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

/** Which cycle-phase markers are shown on the circle / calendar. Presentation
 * only - toggling a marker hides its highlight, never the underlying data. */
export interface CycleMarkers {
  /** Logged-period coloring + predicted-period overlay. */
  menstruation: boolean;
  fertile: boolean;
  ovulation: boolean;
  /** PMS is opt-in and stays hidden until the cycle is predictable enough. */
  pms: boolean;
}

/**
 * How the app frames cycle tracking. `standard` assumes regularity and forecasts
 * confidently. `perimenopause` expects irregularity: it relaxes/suppresses
 * predictions, widens bands, surfaces "unknown" and treats long gaps as a signal
 * rather than an error. `postmenopause` drops cycle forecasts entirely (logging +
 * history only). See `docs/21_plan_perimenopause_mode.md`.
 */
export type TrackingMode = 'standard' | 'perimenopause' | 'postmenopause';

/** Per-user preferences, stored end-to-end encrypted in `users.encSettings`. */
export interface UserSettings {
  /** Typical cycle length in days; seeds the next-period estimate and the cycle
   * circle's slot count until real history accumulates. */
  averageCycleLength: number;
  /** How cycle tracking is framed (regular vs perimenopause vs postmenopause). */
  trackingMode: TrackingMode;
  /** Inactivity timeout before the vault auto-locks, in ms (one of
   * `AUTO_LOCK_PRESETS_MS`). */
  autoLockMs: number;
  /** Whether to lock the vault the instant the tab is hidden/backgrounded. */
  lockOnHidden: boolean;
  /** Which cycle-phase markers to show on the circle/calendar. */
  markers: CycleMarkers;
}

/** The default cycle length offered at onboarding and assumed when a user has
 * no stored settings yet. */
export const DEFAULT_AVERAGE_CYCLE_LENGTH = 28;

/** Menstruation/fertile/ovulation default on; PMS defaults off (least
 * universally wanted, most easily misread as authoritative). */
export const DEFAULT_CYCLE_MARKERS: CycleMarkers = {
  menstruation: true,
  fertile: true,
  ovulation: true,
  pms: false,
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  averageCycleLength: DEFAULT_AVERAGE_CYCLE_LENGTH,
  trackingMode: 'standard',
  autoLockMs: AUTO_LOCK_MS,
  lockOnHidden: true,
  markers: DEFAULT_CYCLE_MARKERS,
};

/**
 * The marker defaults applied when a user switches into a mode. `standard` keeps
 * the usual set; perimenopause and postmenopause keep period coloring on but turn
 * the forecast markers (fertile/ovulation/PMS) off, since they're unreliable or
 * irrelevant once cycles become irregular. The user can still re-enable any
 * marker afterwards - this only seeds sensible defaults on the switch.
 */
export function defaultMarkersForMode(mode: TrackingMode): CycleMarkers {
  if (mode === 'standard') return { ...DEFAULT_CYCLE_MARKERS };
  return { menstruation: true, fertile: false, ovulation: false, pms: false };
}
