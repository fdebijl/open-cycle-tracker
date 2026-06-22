import { addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import {
  cycleStats,
  FERTILE_POST_DAYS,
  FERTILE_PRE_DAYS,
  LUTEAL_PHASE_DAYS,
  MAX_PLAUSIBLE_LENGTH,
  MIN_PLAUSIBLE_LENGTH,
  ROLLING_WINDOW,
} from './prediction';
import type { CycleStats } from './prediction';
import { BBT_SLUG, FLOW_SLUG } from './cycles';
import type { Day } from './types';

/**
 * Derived insights for the Info screen's charts: cycle-length
 * history with a regularity trend, and a symptom-vs-cycle-phase matrix.
 *
 * Like `cycles.ts` and `prediction.ts` this is pure and client-side - no React,
 * no hooks, no I/O. It deliberately takes minimal id-bearing shapes so it needs
 * no decryption key: the symptom aggregation runs on raw factor DTOs (their
 * `categoryLevelId` is plaintext) and only the day *dates* (already decrypted by
 * the caller) are read.
 */

// `mean`/`stdDev` are private to prediction.ts; a small local copy avoids
// widening that module's public surface for two three-line helpers.
function mean(xs: number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Sample standard deviation (n − 1). 0 for fewer than two values. */
function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

// ---- Cycle-length history + regularity trend -----------------------------

export interface CycleLengthPoint {
  /** The cycle that ran during this interval (the one with the earlier onset);
   * null when the onset list carried no id for it. */
  cycleId: string | null;
  /** Interval start (the earlier onset) - the chart's x-axis anchor. */
  onset: Date;
  /** Observed onset-to-onset length, in days. */
  length: number;
  /** Causal trailing-window mean of plausible lengths up to and including this
   * point (the regularity trend line). */
  rollingAverage: number;
  /** Causal trailing-window sample std-dev; 0 until two plausible lengths seen. */
  variability: number;
  /** `rollingAverage` ± round(variability) - the regularity band. */
  bandLow: number;
  bandHigh: number;
  /** Whether the length is within the plausible range; outliers are still drawn
   * but excluded from the trend (same policy as `observedCycleLengths`). */
  plausible: boolean;
}

export interface CycleLengthHistory {
  /** One point per completed cycle, oldest > newest. The in-progress current
   * cycle (no successor onset) yields no point. */
  points: CycleLengthPoint[];
  /** The same learned/configured stats the rest of the app shows, for the
   * headline ("learned from N cycles" / variability caption). */
  stats: CycleStats;
}

function isPlausibleLength(len: number): boolean {
  return len >= MIN_PLAUSIBLE_LENGTH && len <= MAX_PLAUSIBLE_LENGTH;
}

/**
 * Per-cycle length history with a causal regularity trend. Where `cycleStats`
 * gives one global learned average, this gives the running average *as it looked
 * at each cycle*, so the chart can draw a trend line and a ± variability band
 * over time.
 */
export function cycleLengthHistory(
  onsets: { id: string; onset: Date | null }[],
  configuredAverage: number,
): CycleLengthHistory {
  const dated = onsets
    .filter((o): o is { id: string; onset: Date } => o.onset != null)
    .sort((a, b) => a.onset.getTime() - b.onset.getTime());

  const points: CycleLengthPoint[] = [];
  // Trailing window of plausible lengths seen so far (causal: never peeks ahead).
  const window: number[] = [];
  for (let i = 1; i < dated.length; i += 1) {
    const length = differenceInCalendarDays(dated[i]!.onset, dated[i - 1]!.onset);
    const plausible = isPlausibleLength(length);
    if (plausible) {
      window.push(length);
      if (window.length > ROLLING_WINDOW) window.shift();
    }
    const rollingAverage = window.length > 0 ? Math.round(mean(window)) : length;
    const variability = stdDev(window);
    const margin = Math.round(variability);
    points.push({
      cycleId: dated[i - 1]!.id,
      onset: dated[i - 1]!.onset,
      length,
      rollingAverage,
      variability,
      bandLow: rollingAverage - margin,
      bandHigh: rollingAverage + margin,
      plausible,
    });
  }

  return { points, stats: cycleStats(dated.map((o) => o.onset), configuredAverage) };
}

// ---- Cycle-phase classification ------------------------------------------

export const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const;
export type CyclePhase = (typeof PHASES)[number];

/**
 * Classify a day into a cycle phase using the luteal-phase (calendar) method,
 * aligned with `predictFertileWindow`: ovulation is counted back a fixed luteal
 * phase from the next onset, with the fertile window around it.
 *
 * - A period day (`isPeriodDay`) is `menstrual`, regardless of count-back.
 * - Otherwise the next onset is `nextOnset` if known, else `onset + averageLength`.
 *   With neither, the phase can't be placed > `null`.
 * - A date before `onset` belongs to an earlier cycle > `null`.
 */
export function classifyPhase(args: {
  date: Date;
  onset: Date;
  nextOnset?: Date | null;
  averageLength?: number;
  isPeriodDay: boolean;
}): CyclePhase | null {
  const { date, onset, nextOnset, averageLength, isPeriodDay } = args;
  if (isPeriodDay) return 'menstrual';
  if (differenceInCalendarDays(date, onset) < 0) return null;

  const effectiveNextOnset = nextOnset ?? (averageLength != null ? addDays(onset, averageLength) : null);
  if (!effectiveNextOnset) return null;

  const ovulation = addDays(effectiveNextOnset, -LUTEAL_PHASE_DAYS);
  // Cycle too short for the luteal model to place an ovulatory window (ovulation
  // would fall on or before the onset): fall back to a follicular/luteal split
  // at the cycle midpoint.
  if (differenceInCalendarDays(ovulation, onset) <= 0) {
    const midpoint = addDays(onset, Math.round(differenceInCalendarDays(effectiveNextOnset, onset) / 2));
    return differenceInCalendarDays(date, midpoint) < 0 ? 'follicular' : 'luteal';
  }

  const fertileStart = addDays(ovulation, -FERTILE_PRE_DAYS);
  const fertileEnd = addDays(ovulation, FERTILE_POST_DAYS);
  if (isWithinInterval(date, { start: fertileStart, end: fertileEnd })) return 'ovulatory';
  return differenceInCalendarDays(date, fertileStart) < 0 ? 'follicular' : 'luteal';
}

// ---- Symptom × phase matrix ----------------------------------------------

export type PhaseCounts = Record<CyclePhase, number>;

export interface LevelPhaseRow {
  categoryLevelId: string;
  counts: PhaseCounts;
  total: number;
}

export interface CategoryPhaseRow {
  categoryId: string;
  counts: PhaseCounts;
  total: number;
  /** Per-level breakdown, desc by total. */
  levels: LevelPhaseRow[];
}

export interface SymptomPhaseMatrix {
  /** One row per non-excluded category that has logged factors, desc by total. */
  categories: CategoryPhaseRow[];
  /** Number of classified days in each phase - the heatmap's denominator (so a
   * cell can show "logged on X of Y days in this phase"). */
  phaseDayTotals: PhaseCounts;
  /** Dated days that couldn't be placed in any phase (e.g. before any onset). */
  unclassifiedDays: number;
}

function zeroCounts(): PhaseCounts {
  return { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 };
}

/**
 * Aggregate logged symptoms by the cycle phase of the day they fall on. Excludes
 * Flow (it defines the menstrual phase) and BBT (numeric/encrypted) by slug;
 * custom user categories flow through. A symptom level logged twice on one day
 * counts once (factor-day semantics).
 */
export function symptomPhaseMatrix(args: {
  days: Day[];
  factors: { dayId: string; categoryLevelId: string }[];
  categories: { id: string; slug: string | null }[];
  levels: { id: string; categoryId: string }[];
  onsets: { id: string; onset: Date | null }[];
  periodDayIds: Set<string>;
  averageLength: number;
  excludeSlugs?: Set<string>;
}): SymptomPhaseMatrix {
  const { days, factors, categories, levels, onsets, periodDayIds, averageLength } = args;
  const excludeSlugs = args.excludeSlugs ?? new Set([FLOW_SLUG, BBT_SLUG]);

  // Lookups: level > category, and the set of excluded category/level ids.
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const excludedCategoryIds = new Set(
    categories.filter((c) => c.slug != null && excludeSlugs.has(c.slug)).map((c) => c.id),
  );
  const levelToCategory = new Map(levels.map((l) => [l.id, l.categoryId]));

  // Sorted, non-null onsets so each day can find its cycle (latest onset ≤ date)
  // and that cycle's successor onset.
  const sortedOnsets = onsets
    .filter((o): o is { id: string; onset: Date } => o.onset != null)
    .sort((a, b) => a.onset.getTime() - b.onset.getTime());

  const phaseDayTotals = zeroCounts();
  let unclassifiedDays = 0;
  // dayId > phase, for the days we managed to classify.
  const phaseByDay = new Map<string, CyclePhase>();

  for (const day of days) {
    if (!day.date) continue;
    const date = day.date;
    // The cycle this day falls in: latest onset on or before the date.
    let idx = -1;
    for (let i = 0; i < sortedOnsets.length; i += 1) {
      if (differenceInCalendarDays(date, sortedOnsets[i]!.onset) >= 0) idx = i;
      else break;
    }
    if (idx < 0) {
      unclassifiedDays += 1;
      continue;
    }
    const phase = classifyPhase({
      date,
      onset: sortedOnsets[idx]!.onset,
      nextOnset: sortedOnsets[idx + 1]?.onset ?? null,
      averageLength,
      isPeriodDay: periodDayIds.has(day.id),
    });
    if (!phase) {
      unclassifiedDays += 1;
      continue;
    }
    phaseDayTotals[phase] += 1;
    phaseByDay.set(day.id, phase);
  }

  // Tally factors, de-duped per (day, level) so a level logged twice on one day
  // counts once. Key on the level row so category totals stay a sum of levels.
  const levelRows = new Map<string, LevelPhaseRow>();
  const levelCategory = new Map<string, string>();
  const seen = new Set<string>();
  for (const f of factors) {
    const phase = phaseByDay.get(f.dayId);
    if (!phase) continue;
    const categoryId = levelToCategory.get(f.categoryLevelId);
    if (!categoryId || excludedCategoryIds.has(categoryId)) continue;
    const dedupeKey = `${f.dayId}::${f.categoryLevelId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let row = levelRows.get(f.categoryLevelId);
    if (!row) {
      row = { categoryLevelId: f.categoryLevelId, counts: zeroCounts(), total: 0 };
      levelRows.set(f.categoryLevelId, row);
      levelCategory.set(f.categoryLevelId, categoryId);
    }
    row.counts[phase] += 1;
    row.total += 1;
  }

  // Roll level rows up into their categories.
  const categoryRows = new Map<string, CategoryPhaseRow>();
  for (const [levelId, row] of levelRows) {
    const categoryId = levelCategory.get(levelId)!;
    let cat = categoryRows.get(categoryId);
    if (!cat) {
      cat = { categoryId, counts: zeroCounts(), total: 0, levels: [] };
      categoryRows.set(categoryId, cat);
    }
    cat.levels.push(row);
    cat.total += row.total;
    for (const phase of PHASES) cat.counts[phase] += row.counts[phase];
  }

  const sortByTotalDesc = <T extends { total: number }>(a: T, b: T) => b.total - a.total;
  const categoriesOut = [...categoryRows.values()]
    .filter((c) => categoryById.has(c.categoryId))
    .sort(sortByTotalDesc);
  for (const cat of categoriesOut) cat.levels.sort(sortByTotalDesc);

  return { categories: categoriesOut, phaseDayTotals, unclassifiedDays };
}
