import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Day } from './types';

/**
 * Pure cycle math, shared by the circle, calendar and info screens. In the
 * onset-driven model a cycle's boundaries aren't stored on the server (it can't
 * read the encrypted dates) — they're derived here, client-side, from the
 * decrypted day dates.
 */

/** A cycle's onset (day 1) = the earliest period day, or failing that the
 * earliest dated day. `null` when the cycle has no dated days yet. */
export function cycleOnset(days: Day[]): Date | null {
  const periodDates = days.filter((d) => d.dayType === 'period' && d.date).map((d) => d.date as Date);
  const pool = periodDates.length > 0 ? periodDates : days.filter((d) => d.date).map((d) => d.date as Date);
  if (pool.length === 0) return null;
  return pool.reduce((earliest, d) => (d.getTime() < earliest.getTime() ? d : earliest));
}

/** 1-based day number of `date` within a cycle that started on `onset`. */
export function cycleDayNumber(date: Date, onset: Date): number {
  return differenceInCalendarDays(date, onset) + 1;
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
