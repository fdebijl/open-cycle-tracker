import { addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import { nextPeriodEstimate } from './cycles';
import type { NextPeriodEstimate } from './cycles';
import type { SymptothermalResult } from './symptothermal';
import type { CycleMarkers, TrackingMode } from './types';

/**
 * Cycle prediction, learned from observed history. Where `cycles.ts` derives a
 * single cycle's geometry, this module looks across *all* of a user's cycle
 * onsets to learn a typical length (rolling average + variability) and forecast
 * the next period, ovulation, and fertile window.
 */

/** Observed onset-to-onset lengths needed before we trust a learned average
 * over the user's configured value. */
export const MIN_CYCLES_TO_LEARN = 3;

/** Learn the average over at most this many of the most recent cycles, so the
 * estimate tracks recent rhythm rather than ancient history. */
export const ROLLING_WINDOW = 6;

/** Onset gaps outside this range are treated as outliers and dropped (a skipped
 * or very late period, or a retroactively inserted onset). This is a coarse
 * outer sanity bound; the personalised, CLD-relative skip detection below
 * (`flagSkippedCycles`) is the primary signal for "this gap is a skipped log". */
export const MIN_PLAUSIBLE_LENGTH = 15;
export const MAX_PLAUSIBLE_LENGTH = 90;

/** Per-user median Cycle-Length-Difference (CLD) above which a user's cycles are
 * "consistently highly variable" - the threshold from Li, Urteaga & Elhadad
 * (npj Digital Medicine 2020, Clue dataset). Used to widen the prediction band
 * and surface a regularity insight rather than feign day-level precision. */
export const HIGH_CLD_MEDIAN_DAYS = 9;

/** A cycle whose CLD exceeds the user's *own* median CLD by at least this many
 * days is flagged as atypically long - empirically a skipped/unlogged period
 * (≈89% contain no bleeding) rather than a true long cycle. A relative,
 * per-user replacement for a fixed length cap. */
export const SKIP_CLD_EXCESS_DAYS = 10;

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

/** A gap of at least this many days counts as a skipped cycle / amenorrhea
 * rather than a long-but-normal cycle. The ReSTAGE-validated STRAW+10 threshold
 * for the late menopausal transition (preferred over the older 90-day rule). In
 * perimenopause mode this is also the ceiling for lengths fed into the average,
 * so a skip doesn't quietly inflate the learned cycle length. */
export const SKIPPED_CYCLE_MIN_GAP = 60;

/** Amenorrhea of this length (12 months) marks postmenopause under STRAW+10. */
export const POSTMENOPAUSE_AMENORRHEA_DAYS = 365;

/** A >=7-day difference between consecutive cycle lengths is the STRAW+10 early
 * menopausal transition signal. */
export const EARLY_TRANSITION_LENGTH_DIFF = 7;

/** Cycle-length variability (std-dev, days) at or above which a perimenopause
 * forecast is downgraded to low confidence (and its window floored, below). */
export const LOW_CONFIDENCE_VARIABILITY = 7;

/** In perimenopause we never present a next-period band tighter than this, even
 * if the recent sample looks deceptively tight - the honest uncertainty is wider. */
export const PERI_MIN_WINDOW_MARGIN = 5;

/** How much to trust a forecast. `standard` is always `high` (predictions behave
 * exactly as before). Perimenopause downgrades to `low` (wide but shown) or
 * `unknown` (suppressed - shown as "unknown" rather than a fabricated date). */
export type PredictionConfidence = 'high' | 'low' | 'unknown';

export interface CycleStats {
  /** Plausible observed onset-to-onset lengths, oldest > newest. */
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
  /** How far to trust the forecast (drives "unknown"/widened states in
   * perimenopause; always `high` in standard mode). */
  confidence: PredictionConfidence;
  /** Recent onset-to-onset gaps that look like skipped cycles (>=
   * `SKIPPED_CYCLE_MIN_GAP`) - the signal perimenopause cares about, which the
   * average deliberately excludes. 0 in standard mode. */
  skippedCycleCount: number;
  /** Longest recent onset-to-onset gap in days (including skips), or `null` with
   * fewer than two onsets. Lets the UI surface "a 60+ day gap was detected". */
  longestRecentGap: number | null;
  /** Median Cycle-Length-Difference (|consecutive length diff|) over the same
   * recent window the average is taken from - a robust variability metric, less
   * outlier-sensitive than the std-dev. 0 when configured or < 2 lengths. */
  medianCld: number;
  /** Whether the user's cycles are "consistently highly variable"
   * (`medianCld > HIGH_CLD_MEDIAN_DAYS`). Predictions should be framed as
   * approximate for these users. */
  isHighlyVariable: boolean;
  /** How many of the recent observed lengths look like a skipped/unlogged period
   * by the CLD-relative test (CLD exceeds the user's own median CLD by
   * `SKIP_CLD_EXCESS_DAYS`). Distinct from `skippedCycleCount`, which is the
   * absolute >=60-day perimenopause signal. */
  skippedCount: number;
}

/** Options that adapt the stats to a tracking mode. `asOf` (usually today) lets
 * the model notice an *open* long gap - a current cycle running past the skip
 * threshold - which onset-to-onset gaps alone can't see. */
export interface CycleStatsOptions {
  mode?: TrackingMode;
  asOf?: Date;
}

export interface NextPeriodPrediction extends NextPeriodEstimate {
  /** Earliest / latest likely onset (predicted date ± rounded variability).
   * Collapses to `date` when there's no variability. `null` with no onset. */
  windowStart: Date | null;
  windowEnd: Date | null;
}

export interface FertilePrediction {
  /** Forward-predicted ovulation day (calendar method), or `null` when it can't
   * be estimated. A point estimate is inherently imprecise (the true day spans a
   * ~10-day range), so it is presented as the centre of a window, not a promise. */
  ovulation: Date | null;
  /** Inclusive fertile-window bounds, or `null`. */
  fertileStart: Date | null;
  fertileEnd: Date | null;
  /** Whether symptothermal signals (BBT + cervical fluid) have *confirmed*
   * ovulation for the current cycle. Only set by `refineFertileWindow`; absent on
   * the bare forward forecast. Informational only - never a contraceptive signal. */
  confirmed?: boolean;
  /** The retrospectively confirmed ovulation day for the current cycle, when
   * `confirmed`. Distinct from the forward `ovulation` estimate. */
  confirmedOvulation?: Date | null;
}

export interface PmsPrediction {
  /** Inclusive PMS-window bounds, or null when it can't be predicted reliably. */
  pmsStart: Date | null;
  pmsEnd: Date | null;
}

/** A forecast label for an empty future slot/cell. `ovulation-confirmed` is the
 * retrospectively confirmed ovulation day (symptothermal) for the current cycle,
 * distinct from the forward `ovulation` estimate. */
export type ForecastType = 'fertile' | 'ovulation' | 'ovulation-confirmed' | 'pms';

/** Every onset-to-onset gap, oldest > newest, with no plausibility filtering.
 * The latest onset yields no gap (it has no successor). Skipped cycles show up
 * here as large gaps - the raw signal `observedCycleLengths` filters out. */
function rawCycleGaps(onsets: Date[]): number[] {
  const sorted = [...onsets].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(differenceInCalendarDays(sorted[i], sorted[i - 1]));
  }
  return gaps;
}

/** Plausible onset-to-onset lengths from a set of cycle onsets, oldest > newest.
 * The latest onset yields no length (it has no successor), so an in-progress
 * cycle never pollutes the average. `maxLength` caps what counts as a cycle (vs a
 * skipped cycle): perimenopause passes a lower ceiling so a skip doesn't inflate
 * the learned average. */
export function observedCycleLengths(onsets: Date[], maxLength: number = MAX_PLAUSIBLE_LENGTH): number[] {
  return rawCycleGaps(onsets).filter((len) => len >= MIN_PLAUSIBLE_LENGTH && len <= maxLength);
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

/** Pick the forecast confidence from the mode and the shape of recent history.
 * Standard mode is always `high`, so its predictions are unchanged. */
function pickConfidence(
  mode: TrackingMode,
  source: 'learned' | 'configured',
  variability: number,
  openAmenorrhea: boolean,
  skippedCycleCount: number,
): PredictionConfidence {
  if (mode === 'standard') return 'high';
  // Postmenopause: cycles have ended; we never claim to predict the next one.
  if (mode === 'postmenopause') return 'unknown';
  // Perimenopause: be honest about how shaky the forecast is.
  if (openAmenorrhea) return 'unknown'; // a current cycle running past the skip threshold
  if (source === 'configured') return 'unknown'; // not enough regular history to trust
  if (variability >= LOW_CONFIDENCE_VARIABILITY || skippedCycleCount > 0) return 'low';
  return 'high';
}

/** Median of a list of numbers. 0 for an empty list. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Cycle-Length-Differences: the absolute difference between each pair of
 * consecutive observed lengths. Empty for fewer than two lengths. */
export function cycleLengthDifferences(lengths: number[]): number[] {
  const diffs: number[] = [];
  for (let i = 1; i < lengths.length; i += 1) diffs.push(Math.abs(lengths[i] - lengths[i - 1]));
  return diffs;
}

/** Per-user median CLD - a robust variability metric (Li/Urteaga/Elhadad).
 * 0 when there are fewer than two lengths (no CLD to take). */
export function medianCld(lengths: number[]): number {
  return median(cycleLengthDifferences(lengths));
}

/** A recent observed length flagged as a likely skipped/unlogged period. */
export interface SkipFlag {
  /** Index into the `lengths` array passed in. */
  index: number;
  /** The flagged onset-to-onset length, in days. */
  length: number;
  /** Its CLD (difference from the previous length). */
  cld: number;
}

/** Flag lengths whose CLD exceeds the user's own median CLD by at least
 * `SKIP_CLD_EXCESS_DAYS` - a personalised "this gap is probably a skipped log"
 * detector that adapts to each user's natural variability, unlike a fixed cap.
 * `userMedianCld` is taken from the same window as `lengths`. */
export function flagSkippedCycles(lengths: number[], userMedianCld: number): SkipFlag[] {
  const diffs = cycleLengthDifferences(lengths);
  const threshold = userMedianCld + SKIP_CLD_EXCESS_DAYS;
  const byIndex = new Map<number, SkipFlag>();
  for (let i = 0; i < diffs.length; i += 1) {
    if (diffs[i] < threshold) continue;
    // diffs[i] is the CLD between lengths[i] and lengths[i + 1]; the *longer* of
    // the pair is the suspected skip. A single long cycle spikes the CLD on both
    // sides, so dedupe by index and keep the larger CLD.
    const index = lengths[i + 1] >= lengths[i] ? i + 1 : i;
    const existing = byIndex.get(index);
    if (!existing || diffs[i] > existing.cld) byIndex.set(index, { index, length: lengths[index], cld: diffs[i] });
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** Learn a typical cycle length from observed onsets, falling back to the
 * user's configured average until enough history has accumulated. In a
 * non-standard `mode` it also derives a `confidence` and surfaces skipped-cycle
 * signals; pass `asOf` so an open long gap (current cycle past the skip
 * threshold) is noticed. */
export function cycleStats(
  onsets: Date[],
  configuredAverage: number,
  options: CycleStatsOptions = {},
): CycleStats {
  const mode = options.mode ?? 'standard';
  // In perimenopause a gap >= SKIPPED_CYCLE_MIN_GAP is a skip, not a long cycle,
  // so it's kept out of the average; standard keeps its existing wider ceiling.
  const maxLength = mode === 'standard' ? MAX_PLAUSIBLE_LENGTH : SKIPPED_CYCLE_MIN_GAP;
  const observedLengths = observedCycleLengths(onsets, maxLength);

  // Skipped-cycle signals from the most recent raw gaps, plus an open gap (last
  // onset > asOf) so an in-progress amenorrhea counts too.
  const recentRaw = rawCycleGaps(onsets).slice(-ROLLING_WINDOW);
  const sorted = [...onsets].sort((a, b) => a.getTime() - b.getTime());
  const lastOnset = sorted.at(-1) ?? null;
  const openGap = options.asOf && lastOnset ? differenceInCalendarDays(options.asOf, lastOnset) : null;
  const openAmenorrhea = openGap != null && openGap >= SKIPPED_CYCLE_MIN_GAP;
  const skippedCycleCount =
    recentRaw.filter((g) => g >= SKIPPED_CYCLE_MIN_GAP).length + (openAmenorrhea ? 1 : 0);
  const recentGapsWithOpen = openGap != null ? [...recentRaw, openGap] : recentRaw;
  const longestRecentGap = recentGapsWithOpen.length > 0 ? Math.max(...recentGapsWithOpen) : null;

  if (observedLengths.length < MIN_CYCLES_TO_LEARN) {
    return {
      observedLengths,
      averageLength: configuredAverage,
      variability: 0,
      sampleSize: 0,
      source: 'configured',
      confidence: pickConfidence(mode, 'configured', 0, openAmenorrhea, skippedCycleCount),
      skippedCycleCount,
      longestRecentGap,
      medianCld: 0,
      isHighlyVariable: false,
      skippedCount: 0,
    };
  }
  const recent = observedLengths.slice(-ROLLING_WINDOW);
  const variability = stdDev(recent);
  const recentMedianCld = medianCld(recent);
  return {
    observedLengths,
    averageLength: Math.round(mean(recent)),
    variability,
    sampleSize: recent.length,
    source: 'learned',
    confidence: pickConfidence(mode, 'learned', variability, openAmenorrhea, skippedCycleCount),
    skippedCycleCount,
    longestRecentGap,
    medianCld: recentMedianCld,
    isHighlyVariable: recentMedianCld > HIGH_CLD_MEDIAN_DAYS,
    skippedCount: flagSkippedCycles(recent, recentMedianCld).length,
  };
}

/** Coarse STRAW+10 reproductive stage, inferred from onset history alone.
 * Suggestive, never diagnostic: full clinical staging weighs age and excludes
 * pregnancy / hormonal contraception, and lab/FSH values are secondary. Used in
 * v1 only to gently suggest perimenopause mode. */
export type MenopausalStage =
  | 'reproductive'
  | 'early-transition'
  | 'late-transition'
  | 'postmenopause'
  | 'indeterminate';

export interface MenopausalStaging {
  stage: MenopausalStage;
  signals: {
    /** A >=7-day diff between consecutive cycle lengths, recurring (STRAW -2). */
    persistent7DayDiff: boolean;
    /** Amenorrhea >= 60 days, observed or in progress (STRAW -1). */
    amenorrhea60Plus: boolean;
    /** Amenorrhea >= 12 months (postmenopause). */
    amenorrhea12mo: boolean;
  };
}

export function classifyMenopausalStage(onsets: Date[], asOf: Date): MenopausalStaging {
  const sorted = [...onsets].sort((a, b) => a.getTime() - b.getTime());
  const gaps = rawCycleGaps(sorted);
  const lastOnset = sorted.at(-1) ?? null;
  const openGap = lastOnset ? differenceInCalendarDays(asOf, lastOnset) : null;

  const amenorrhea12mo = openGap != null && openGap >= POSTMENOPAUSE_AMENORRHEA_DAYS;
  const amenorrhea60Plus =
    (openGap != null && openGap >= SKIPPED_CYCLE_MIN_GAP) || gaps.some((g) => g >= SKIPPED_CYCLE_MIN_GAP);

  // "Persistent" >=7-day swing: count diffs between consecutive cycle lengths that
  // hit the threshold within the recent window; recurrence (>=2) makes it persistent.
  const recent = gaps.slice(-10);
  let bigSwings = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (Math.abs(recent[i]! - recent[i - 1]!) >= EARLY_TRANSITION_LENGTH_DIFF) bigSwings += 1;
  }
  const persistent7DayDiff = bigSwings >= 2;

  // Amenorrhea signals work off the open gap (one onset + `asOf` is enough); the
  // >=7-day-swing signal needs at least a couple of completed cycles to read.
  let stage: MenopausalStage;
  if (lastOnset == null) stage = 'indeterminate';
  else if (amenorrhea12mo) stage = 'postmenopause';
  else if (amenorrhea60Plus) stage = 'late-transition';
  else if (persistent7DayDiff) stage = 'early-transition';
  else if (gaps.length >= 2) stage = 'reproductive';
  else stage = 'indeterminate'; // too little history to say, and no amenorrhea

  return { stage, signals: { persistent7DayDiff, amenorrhea60Plus, amenorrhea12mo } };
}

/** Forecast the next period: `nextPeriodEstimate` plus a confidence band of
 * ± rounded variability around the predicted date. When the stats are
 * `unknown` confidence (perimenopause amenorrhea / too little regular history,
 * or postmenopause) we refuse to fabricate a date and return nulls, so the UI
 * shows "unknown" instead. Low-confidence forecasts get a minimum band width. */
export function predictNextPeriod(lastOnset: Date | null, stats: CycleStats): NextPeriodPrediction {
  if (stats.confidence === 'unknown') return { date: null, daysUntil: null, windowStart: null, windowEnd: null };
  const estimate = nextPeriodEstimate(lastOnset, stats.averageLength);
  if (!estimate.date) return { ...estimate, windowStart: null, windowEnd: null };
  // Widen the band for highly variable users (median CLD captures irregularity the
  // std-dev can understate) and never below the perimenopause low-confidence floor;
  // only ever widen, then cap so the overlay can't span an implausible range.
  const floor = stats.confidence === 'low' ? PERI_MIN_WINDOW_MARGIN : 0;
  const raw = Math.max(stats.variability, stats.isHighlyVariable ? stats.medianCld : 0, floor);
  const margin = Math.min(Math.round(raw), Math.floor(stats.averageLength / 2));
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
  // The calendar method assumes a regular cycle; only attempt it at high
  // confidence (always true in standard mode, gated in perimenopause).
  if (!lastOnset || stats.confidence !== 'high' || stats.averageLength <= LUTEAL_PHASE_DAYS) return empty;
  const nextOnset = addDays(lastOnset, stats.averageLength);
  const ovulation = addDays(nextOnset, -LUTEAL_PHASE_DAYS);
  return {
    ovulation,
    fertileStart: addDays(ovulation, -FERTILE_PRE_DAYS),
    fertileEnd: addDays(ovulation, FERTILE_POST_DAYS),
  };
}

/** Refine a forward fertile-window forecast with symptothermal confirmation for
 * the *current* cycle. When the double-check (BBT + mucus) has confirmed
 * ovulation, the confirmed day supersedes the forward estimate and the window's
 * end is pulled in to the confirming day. Otherwise the forecast is returned
 * unchanged - so this is safe to call on every cycle, confirmed or not.
 * Informational only: the confirmation never implies an "infertile/safe" state. */
export function refineFertileWindow(
  predicted: FertilePrediction,
  sympto: SymptothermalResult | null,
): FertilePrediction {
  if (!sympto?.confirmed || !sympto.ovulation) return predicted;
  const confirmedOvulation = sympto.ovulation;
  return {
    ...predicted,
    ovulation: confirmedOvulation,
    fertileStart: addDays(confirmedOvulation, -FERTILE_PRE_DAYS),
    fertileEnd: sympto.infertileFrom ?? addDays(confirmedOvulation, FERTILE_POST_DAYS),
    confirmed: true,
    confirmedOvulation,
  };
}

/** Forecast the PMS window: the `PMS_DAYS` leading up to the predicted next
 * onset (the tail of the luteal phase). Returns nulls unless the average is
 * *learned* (>= `MIN_CYCLES_TO_LEARN` observed cycles), variability is tight
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
  if (fertile?.confirmedOvulation && differenceInCalendarDays(date, fertile.confirmedOvulation) === 0) {
    return 'ovulation-confirmed';
  }
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
  if (type === 'ovulation' || type === 'ovulation-confirmed') return markers.ovulation;
  return markers.pms;
}
