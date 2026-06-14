import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Category, CategoryLevel, Day } from './types';

/**
 * Pure cycle math, shared by the circle, calendar and info screens. In the
 * onset-driven model a cycle's boundaries aren't stored on the server (it can't
 * read the encrypted dates) - they're derived here, client-side, from the
 * decrypted day dates.
 *
 * The period signal is the ordinal Flow category: a day with a Flow factor of
 * intensity ≥ Light is a "period day". Callers compute the set of such day ids
 * once (`computePeriodDayIds`) and thread it through.
 */

/** Stable slug of the global Flow category (the period/onset signal). */
export const FLOW_SLUG = 'flow';
/** Stable slug of the global BBT category (rendered as a numeric reading). */
export const BBT_SLUG = 'bbt';
/** Flow levels at this ordinal or above count as a period (onset) day; below it
 * (Spotting = order 0) is spotting only and does not anchor a cycle. */
export const FLOW_PERIOD_MIN_ORDER = 1;

/** The Flow level ids that count as a period day (intensity ≥ Light). */
export function flowPeriodLevelIds(categories: Category[], levels: CategoryLevel[]): Set<string> {
  const flow = categories.find((c) => c.slug === FLOW_SLUG);
  if (!flow) return new Set();
  return new Set(
    levels
      .filter((l) => l.categoryId === flow.id && (l.order ?? 0) >= FLOW_PERIOD_MIN_ORDER)
      .map((l) => l.id),
  );
}

/** Day ids that count as a period day: those carrying a Flow factor ≥ Light.
 * Works on raw factor DTOs - `categoryLevelId` is plaintext, so no decryption
 * (and no DEK) is needed just to locate onset. */
export function computePeriodDayIds(
  factors: { dayId: string; categoryLevelId: string }[],
  flowPeriodLevels: Set<string>,
): Set<string> {
  const ids = new Set<string>();
  for (const f of factors) {
    if (flowPeriodLevels.has(f.categoryLevelId)) ids.add(f.dayId);
  }
  return ids;
}

/** A cycle's onset (day 1) = the earliest period day, or failing that the
 * earliest dated day. `null` when the cycle has no dated days yet. When
 * `periodDayIds` is omitted (or empty) it degrades to the earliest dated day. */
export function cycleOnset(days: Day[], periodDayIds?: Set<string>): Date | null {
  const periodDates =
    periodDayIds && periodDayIds.size > 0
      ? days.filter((d) => periodDayIds.has(d.id) && d.date).map((d) => d.date as Date)
      : [];
  const pool = periodDates.length > 0 ? periodDates : days.filter((d) => d.date).map((d) => d.date as Date);
  if (pool.length === 0) return null;
  return pool.reduce((earliest, d) => (d.getTime() < earliest.getTime() ? d : earliest));
}

/** 1-based day number of `date` within a cycle that started on `onset`. */
export function cycleDayNumber(date: Date, onset: Date): number {
  return differenceInCalendarDays(date, onset) + 1;
}

/** Pair each cycle with its derived onset (from the days that belong to it). The
 * bridge from `useCycles()` + `useDays()` to the onset list that `cycleForDate`
 * and the prediction math consume. */
export function cycleOnsets(
  cycles: { id: string }[],
  days: Day[],
  periodDayIds?: Set<string>,
): { id: string; onset: Date | null }[] {
  return cycles.map((c) => ({
    id: c.id,
    onset: cycleOnset(
      days.filter((d) => d.cycleId === c.id),
      periodDayIds,
    ),
  }));
}

/**
 * Which cycle a (possibly new) day on `date` belongs to: the latest cycle whose
 * onset is on or before that date. Falls back to the current cycle for dates
 * earlier than every recorded onset. Keeps forward-logging correct and avoids
 * mis-filing a tapped past date into the current cycle.
 */
export function cycleForDate(
  date: Date,
  cycles: { id: string; onset: Date | null }[],
  currentCycleId: string,
): string {
  const dated = cycles
    .filter((c): c is { id: string; onset: Date } => c.onset != null)
    .sort((a, b) => a.onset.getTime() - b.onset.getTime());

  let chosen: string | null = null;
  for (const c of dated) {
    if (differenceInCalendarDays(date, c.onset) >= 0) chosen = c.id;
    else break;
  }
  return chosen ?? currentCycleId;
}

export interface NextPeriodEstimate {
  /** Predicted start of the next period, or `null` if the onset is unknown. */
  date: Date | null;
  /** Whole days from today until that date (negative = overdue). */
  daysUntil: number | null;
}

/** Simple estimate: next period ≈ onset + average cycle length. (Real
 * prediction from observed history is a separate, later milestone.) */
export function nextPeriodEstimate(onset: Date | null, averageCycleLength: number): NextPeriodEstimate {
  if (!onset) return { date: null, daysUntil: null };
  const date = addDays(onset, averageCycleLength);
  return { date, daysUntil: differenceInCalendarDays(date, new Date()) };
}
