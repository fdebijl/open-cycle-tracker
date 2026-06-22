import { AUTO_LOCK_MS } from '@/config/env';

/**
 * A cycle is a collection of days, starting a menstruation period.
 * Cycles are automatically ended, and a new one is created, when users log non-consecutive menstruation.
 */
export interface Cycle {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A tracked day. There is no manual "phase" on a day: the period signal is
 * derived from the `flow` category (a Flow factor greater than 'Light' marks a period
 * day), and fertile/ovulation are a computed, non-persisted forecast shown in the
 * cycle overview, not something the user can self-report (accurately).
 */
export interface Day {
  id: string;
  /** The Cycle this Day belongs to */
  cycleId: string;
  /** Order of this day within a Cycle */
  order: number | null;
  /** Full date for this day */
  date: Date | null;
  /** Optional free-text journal note for the day. */
  notes: string | null;
}

/**
 * A Category is something the user can track during their cycle to follow the progress of their cycle
 * or make note of certain symptoms and when they recur. Examples include Flow, Pain, Sex, Energy, Sleep and Mood.
 */
export interface Category {
  id: string;
  /** Global/preset categories won't have a linked user, but custom Categories defined by a user will */
  userId: string | null;
  /** Whether this Category is global or not */
  global: boolean;
  /** Stable identifier on global/preset categories (e.g. `flow`, `bbt`); null otherwise. */
  slug: string | null;
  /** Name of this category, shown in the UI */
  name: string;
  /** Name of the material design icon to use for this category */
  icon: string;
  /** Hex color for this category, shown as the background behind the icon and in My Info */
  color: string;
}

/**
 * CategoryLevel is the level, degree, type or severity of a certain Category.
 * This isn't necessarily ordinal, although some categories are. Ordinal categories would include
 * bleeding (Light > Medium > Heavy), a non-ordinal example would be Sex (Unprotected, Protected, Withdrawal)
 */
export interface CategoryLevel {
  id: string;
  /** Which Category this Level belongs to */
  categoryId: string;
  /** Ordinal position within the category (0-based); null where unordered. */
  order: number | null;
  /** Name of this level, shown in the UI */
  name: string;
  /** Name of the material design icon to use for this level */
  icon: string;
}

/**
 * A factor is an instance of a CategoryLevel for a given Day. While Category and CategoryLevel are fairly static,
 * factors are the day-to-day instances of users experiencing a certain level in a certain category. If you need to get
 * the Category for a Factor, you'll have to fetch the CategoryLevel first and resolve categoryId on there.
 */
export interface Factor {
  id: string;
  /** Which Day this Factor belongs to */
  dayId: string;
  /** Which CategoryLevel this Factor belongs to */
  categoryLevelId: string;
  /** (Currently unused) Notes for this Factor, in case the Level is not explicit enough */
  notes: string | null;
  /** Optional numeric reading (e.g. BBT); null for plain factors. */
  value: number | null;
}

/** Which cycle-phase markers are shown on the circle / calendar. Presentation
 * only - toggling a marker hides its highlight, never the underlying data. */
export interface CycleMarkers {
  /** Logged-period coloring + predicted-period overlay. */
  menstruation: boolean;
  fertile: boolean;
  ovulation: boolean;
  /** PMS is opt-in and stays hidden when enabled until the cycle is predictable enough. */
  pms: boolean;
}

/**
 * How the app frames cycle tracking.
 *
 * `standard` assumes regularity and forecasts accordingly.
 *
 * `perimenopause` expects irregularity: it relaxes/suppresses predictions, widens bands, surfaces "unknown"
 * and treats long gaps as a signal rather than an error.
 *
 * `postmenopause` drops cycle forecasts entirely (logging + history only).
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

/** The default cycle length offered at onboarding and assumed when a user has no stored settings yet. */
export const DEFAULT_AVERAGE_CYCLE_LENGTH = 29;

/** Menstruation/fertile/ovulation default on. PMS defaults off. */
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
 * marker afterwards, this only seeds sensible defaults on the switch.
 */
export function defaultMarkersForMode(mode: TrackingMode): CycleMarkers {
  if (mode === 'standard') return { ...DEFAULT_CYCLE_MARKERS };
  return { menstruation: true, fertile: false, ovulation: false, pms: false };
}
