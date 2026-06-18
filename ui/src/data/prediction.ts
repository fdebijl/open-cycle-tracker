import { addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import { nextPeriodEstimate } from './cycles';
import type { NextPeriodEstimate } from './cycles';
import type { CycleMarkers } from './types';

/**
 * Cycle prediction, learned from observed history. Where `cycles.ts` derives a
 * single cycle's geometry, this module looks across *all* of a user's cycle
 * onsets to learn a typical length (rolling average + variability) and forecast
 * the next period, ovulation, and fertile window.
 *
 * Everything here is pure and client-side: predictions are computed on demand
 * for display, never persisted and never written onto `Day` records (so they
 * can't clobber the user's manual `fertile`/`ovulation` labels).
 *
 * The fertile/ovulation forecast uses the calendar (rhythm) method - a fixed
 * luteal phase counted back from the predicted onset. Inputs like BBT and
 * cervical mucus that would sharpen it are a separate milestone (roadmap #6).
 */

/** Observed onset-to-onset lengths needed before we trust a learned average
 * over the user's configured value. */
export const MIN_CYCLES_TO_LEARN = 3;
/** Learn the average over at most this many of the most recent cycles, so the
 * estimate tracks recent rhythm rather than ancient history. */
export const ROLLING_WINDOW = 6;
/** Onset gaps outside this range are treated as outliers and dropped (a skipped
 * or very late period, or a retroactively inserted onset - roadmap #12). */
export const MIN_PLAUSIBLE_LENGTH = 15;
export const MAX_PLAUSIBLE_LENGTH = 90;
/** Luteal phase length: days from ovulation to the next period onset. Fairly
 * constant across people, unlike the follicular phase, so we count back from the
 * predicted onset. */
export const LUTEAL_PHASE_DAYS = 14;
/** Fertile window: opens this many days before ovulation (sperm lifespan)… */
export const FERTILE_PRE_DAYS = 5;
/** …and closes this many days after (egg lifespan). */
export const FERTILE_POST_DAYS = 1;
/** PMS window: this many days before the predicted next onset (tail of the
 * luteal phase). The symptom cluster is luteal, so we count back from onset, not
 * from an arbitrary cycle end. */
export const PMS_DAYS = 5;
/** Max cycle-length variability (std-dev, days) at which we still trust a PMS
 * forecast. A band wider than the window itself makes the highlight meaningless,
 * so above this we suppress it even when opted in. */
export const PMS_MAX_VARIABILITY = 4;

export interface CycleStats {
  /** Plausible observed onset-to-onset lengths, oldest → newest. */
  observedLengths: number[];
  /** The average cycle length used for prediction. */
  averageLength: number;
  /** Sample standard deviation of the lengths the average was taken over; 0 when
   * the average is `configured` or there are fewer than two observations. */
  variability: number;
  /** How many observed lengths the average was taken over. */
  sampleSize: number;
  /** Whether `averageLength` was learned from history or is the configured seed. */
  source: 'learned' | 'configured';
}

export interface NextPeriodPrediction extends NextPeriodEstimate {
  /** Earliest / latest likely onset (predicted date ± rounded variability).
   * Collapses to `date` when there's no variability. `null` with no onset. */
  windowStart: Date | null;
  windowEnd: Date | null;
}

export interface FertilePrediction {
  /** Predicted ovulation day, or `null` when it can't be estimated. */
  ovulation: Date | null;
  /** Inclusive fertile-window bounds, or `null`. */
  fertileStart: Date | null;
  fertileEnd: Date | null;
}

export interface PmsPrediction {
  /** Inclusive PMS-window bounds, or null when it can't be predicted reliably. */
  pmsStart: Date | null;
  pmsEnd: Date | null;
}

/** A forecast label for an empty future slot/cell. */
export type ForecastType = 'fertile' | 'ovulation' | 'pms';

/** Plausible onset-to-onset lengths from a set of cycle onsets, oldest → newest.
 * The latest onset yields no length (it has no successor), so an in-progress
 * cycle never pollutes the average. */
export function observedCycleLengths(onsets: Date[]): number[] {
  const sorted = [...onsets].sort((a, b) => a.getTime() - b.getTime());
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const len = differenceInCalendarDays(sorted[i], sorted[i - 1]);
    if (len >= MIN_PLAUSIBLE_LENGTH && len <= MAX_PLAUSIBLE_LENGTH) lengths.push(len);
  }
  return lengths;
}

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

/** Learn a typical cycle length from observed onsets, falling back to the
 * user's configured average until enough history has accumulated. */
export function cycleStats(onsets: Date[], configuredAverage: number): CycleStats {
  const observedLengths = observedCycleLengths(onsets);
  if (observedLengths.length < MIN_CYCLES_TO_LEARN) {
    return {
      observedLengths,
      averageLength: configuredAverage,
      variability: 0,
      sampleSize: 0,
      source: 'configured',
    };
  }
  const recent = observedLengths.slice(-ROLLING_WINDOW);
  return {
    observedLengths,
    averageLength: Math.round(mean(recent)),
    variability: stdDev(recent),
    sampleSize: recent.length,
    source: 'learned',
  };
}

/** Forecast the next period: `nextPeriodEstimate` plus a confidence band of
 * ± rounded variability around the predicted date. */
export function predictNextPeriod(lastOnset: Date | null, stats: CycleStats): NextPeriodPrediction {
  const estimate = nextPeriodEstimate(lastOnset, stats.averageLength);
  if (!estimate.date) return { ...estimate, windowStart: null, windowEnd: null };
  const margin = Math.round(stats.variability);
  return {
    ...estimate,
    windowStart: addDays(estimate.date, -margin),
    windowEnd: addDays(estimate.date, margin),
  };
}

/** Forecast ovulation and the fertile window by counting a fixed luteal phase
 * back from the predicted next onset. `null` when there's no onset or the
 * average is too short for the luteal-phase model to be meaningful. */
export function predictFertileWindow(lastOnset: Date | null, stats: CycleStats): FertilePrediction {
  const empty: FertilePrediction = { ovulation: null, fertileStart: null, fertileEnd: null };
  if (!lastOnset || stats.averageLength <= LUTEAL_PHASE_DAYS) return empty;
  const nextOnset = addDays(lastOnset, stats.averageLength);
  const ovulation = addDays(nextOnset, -LUTEAL_PHASE_DAYS);
  return {
    ovulation,
    fertileStart: addDays(ovulation, -FERTILE_PRE_DAYS),
    fertileEnd: addDays(ovulation, FERTILE_POST_DAYS),
  };
}

/** Forecast the PMS window: the `PMS_DAYS` leading up to the predicted next
 * onset (the tail of the luteal phase). Returns nulls unless the average is
 * *learned* (≥ `MIN_CYCLES_TO_LEARN` observed cycles), variability is tight
 * enough to be meaningful, and the window fits in the luteal phase without
 * colliding with the fertile window - PMS is opt-in and we refuse to show a
 * guess dressed up as a prediction. */
export function predictPmsWindow(lastOnset: Date | null, stats: CycleStats): PmsPrediction {
  const empty: PmsPrediction = { pmsStart: null, pmsEnd: null };
  if (!lastOnset || stats.source !== 'learned') return empty;
  if (stats.variability > PMS_MAX_VARIABILITY) return empty;
  if (stats.averageLength <= LUTEAL_PHASE_DAYS + PMS_DAYS) return empty;
  const nextOnset = addDays(lastOnset, stats.averageLength);
  return {
    // The window ends the day before onset and spans PMS_DAYS inclusive.
    pmsStart: addDays(nextOnset, -PMS_DAYS),
    pmsEnd: addDays(nextOnset, -1),
  };
}

/** Forecast label for a future `date`, for overlaying predictions on empty
 * circle slots / calendar cells. Precedence is `ovulation` > `fertile` > `pms`
 * (deterministic; the reliability gates keep them from overlapping in practice).
 * `null` when the date falls outside every predicted window. */
export function forecastDayType(date: Date, fertile?: FertilePrediction, pms?: PmsPrediction): ForecastType | null {
  if (fertile?.ovulation && differenceInCalendarDays(date, fertile.ovulation) === 0) return 'ovulation';
  if (fertile?.fertileStart && fertile.fertileEnd && isWithinInterval(date, { start: fertile.fertileStart, end: fertile.fertileEnd })) {
    return 'fertile';
  }
  if (pms?.pmsStart && pms.pmsEnd && isWithinInterval(date, { start: pms.pmsStart, end: pms.pmsEnd })) {
    return 'pms';
  }
  return null;
}

/** Whether a forecast label maps to a marker the user has switched on. Lets the
 * fertile and ovulation toggles act independently even though both derive from
 * one `FertilePrediction`. */
export function forecastMarkerEnabled(type: ForecastType, markers: CycleMarkers): boolean {
  if (type === 'fertile') return markers.fertile;
  if (type === 'ovulation') return markers.ovulation;
  return markers.pms;
}
