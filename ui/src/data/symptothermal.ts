import { addDays, differenceInCalendarDays } from 'date-fns';

/**
 * Symptothermal ovulation *confirmation* for the current cycle, from the BBT and
 * cervical-fluid data the user already logs. This is the validated "Fertility
 * Awareness" upgrade over the calendar method - but it is **retrospective**: it
 * confirms that ovulation has occurred once enough daily temperatures + mucus
 * observations exist. It never forecasts a future fertile window (the calendar
 * method in `prediction.ts` does that); it only sharpens the *current* cycle.
 *
 * The rules below are a clean-room reimplementation of the publicly documented
 * Sensiplan / NFP method (temperature "3-over-6" rule with its two exceptions,
 * and the cervical-mucus peak-day +3 rule, combined as a double-check). They are
 * written from the published method, not ported from any GPL/AGPL codebase.
 *
 * IMPORTANT - this is informational only. OCT is not a certified fertility
 * awareness method and must never present an "infertile / safe" status or be
 * relied on for contraception. Everything here is pure and client-side.
 */

export type MucusQuality = 'egg-white' | 'creamy' | 'sticky' | 'atypical';

/** One dated day of the current cycle with its decrypted symptothermal signals.
 * Either field may be null on a day the user didn't log it. */
export interface SymptoDay {
  date: Date;
  /** Decrypted basal body temperature, assumed °C (the 0.2 margin is Celsius). */
  temperature: number | null;
  /** Cervical-fluid quality logged that day, normalised to a fixed enum. */
  mucus: MucusQuality | null;
}

/** Temperatures used to build the coverline (the low-phase baseline). */
export const COVERLINE_WINDOW = 6;
/** Consecutive high temperatures needed to confirm the shift (regular rule). */
export const HIGH_TEMP_RUN = 3;
/** The confirming high temperature must clear the coverline by this much (°C). */
export const REGULAR_RULE_MARGIN_C = 0.2;
/** Evenings of drier mucus after the peak day that confirm the mucus shift. */
export const MUCUS_PEAK_PLUS = 3;

/** Float tolerance for the 0.2 °C / coverline comparisons. */
const EPSILON = 1e-9;

/** Cervical-fluid fertility ranking (higher = more fertile). `atypical` is
 * ambiguous and excluded from peak detection. */
const MUCUS_FERTILITY: Record<MucusQuality, number | null> = {
  'egg-white': 3,
  creamy: 2,
  sticky: 1,
  atypical: null,
};
/** A peak day must be genuinely fertile-quality (creamy or egg-white). */
const PEAK_MIN_FERTILITY = 2;

export interface TempShift {
  /** The First Higher Measurement that anchors the shift. */
  fhmDate: Date;
  /** Coverline (low-temperature baseline): the max of the prior 6 readings. */
  coverline: number;
  /** Estimated ovulation: the day before the first higher measurement. */
  ovulation: Date;
  /** The day the shift is fully confirmed (3rd or 4th high reading). */
  confirmedDate: Date;
  /** Which Sensiplan rule confirmed the shift. */
  rule: 'regular' | 'first-exception' | 'second-exception';
}

type TempDay = SymptoDay & { temperature: number };

/** Evaluate the BBT "3-over-6" temperature shift with the two documented
 * Sensiplan exceptions (tolerating a single dip). Returns the earliest valid
 * shift, or null until one is established. */
export function evaluateTempShift(days: SymptoDay[]): TempShift | null {
  const temps = days
    .filter((d): d is TempDay => d.temperature != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (let i = COVERLINE_WINDOW; i < temps.length; i += 1) {
    const window = temps.slice(i - COVERLINE_WINDOW, i);
    const coverline = Math.max(...window.map((d) => d.temperature));
    const fhm = temps[i];
    if (fhm.temperature <= coverline) continue; // not a higher measurement

    const above = (d?: TempDay) => d != null && d.temperature > coverline + EPSILON;
    const wellAbove = (d?: TempDay) => d != null && d.temperature >= coverline + REGULAR_RULE_MARGIN_C - EPSILON;
    const d1 = temps[i + 1];
    const d2 = temps[i + 2];
    const d3 = temps[i + 3];
    const base = { fhmDate: fhm.date, coverline, ovulation: addDays(fhm.date, -1) } as const;

    // Regular rule: two following readings above the coverline, the 2nd of them
    // (the 3rd high overall) at least 0.2 °C above it.
    if (above(d1) && above(d2) && wellAbove(d2)) {
      return { ...base, confirmedDate: d2.date, rule: 'regular' };
    }
    // First exception: the 0.2 °C margin isn't met, so a 4th reading is required
    // - three following readings all above the coverline.
    if (above(d1) && above(d2) && above(d3)) {
      return { ...base, confirmedDate: d3.date, rule: 'first-exception' };
    }
    // Second exception: exactly one of the two following readings falls back
    // to/below the coverline, and a 4th reading clears it by 0.2 °C.
    if (d1 != null && d2 != null && d3 != null) {
      const dips = [above(d1), above(d2)].filter((isAbove) => !isAbove).length;
      if (dips === 1 && wellAbove(d3)) {
        return { ...base, confirmedDate: d3.date, rule: 'second-exception' };
      }
    }
  }
  return null;
}

/** Evaluate the cervical-mucus peak day: the last day of the most-fertile mucus
 * quality that is followed by `MUCUS_PEAK_PLUS` drier days. Returns the peak
 * date, or null when no peak is confirmed. */
export function evaluateMucusPeak(days: SymptoDay[]): Date | null {
  const obs = days
    .filter((d) => d.mucus != null && MUCUS_FERTILITY[d.mucus] != null)
    .map((d) => ({ date: d.date, fertility: MUCUS_FERTILITY[d.mucus as MucusQuality] as number }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let best = 0;
  let peak: Date | null = null;
  for (let k = 0; k < obs.length; k += 1) {
    best = Math.max(best, obs[k].fertility);
    if (obs[k].fertility !== best || best < PEAK_MIN_FERTILITY) continue;
    const following = obs.slice(k + 1, k + 1 + MUCUS_PEAK_PLUS);
    if (following.length < MUCUS_PEAK_PLUS) continue;
    // The peak is confirmed only if every following observation is drier.
    if (following.every((f) => f.fertility < best)) peak = obs[k].date; // keep the latest confirmed peak
  }
  return peak;
}

export interface SymptothermalResult {
  /** True once the double-check confirms: both a temperature shift AND a mucus
   * peak have been established. */
  confirmed: boolean;
  /** Confirmed ovulation day for this cycle (from the temperature shift), or
   * null when not yet confirmed. */
  ovulation: Date | null;
  /** The day the post-ovulatory phase begins (later of the two confirmations).
   * Used to narrow the fertile-window overlay; never surfaced as an "infertile"
   * status. Null until confirmed. */
  infertileFrom: Date | null;
  /** Which signals contributed, for UI transparency. */
  basis: { temp: boolean; mucus: boolean };
}

/** Sensiplan double-check: ovulation is confirmed only when both a temperature
 * shift and a mucus peak are present; the post-ovulatory phase begins on the
 * later of the two evaluation-complete days. Pure and retrospective. */
export function symptothermal(days: SymptoDay[]): SymptothermalResult {
  const tempShift = evaluateTempShift(days);
  const mucusPeak = evaluateMucusPeak(days);
  const basis = { temp: tempShift != null, mucus: mucusPeak != null };

  if (!tempShift || !mucusPeak) {
    return { confirmed: false, ovulation: null, infertileFrom: null, basis };
  }

  const mucusComplete = addDays(mucusPeak, MUCUS_PEAK_PLUS);
  const infertileFrom =
    differenceInCalendarDays(tempShift.confirmedDate, mucusComplete) >= 0 ? tempShift.confirmedDate : mucusComplete;
  return { confirmed: true, ovulation: tempShift.ovulation, infertileFrom, basis };
}
