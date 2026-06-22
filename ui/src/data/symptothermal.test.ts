import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { evaluateMucusPeak, evaluateTempShift, symptothermal } from './symptothermal';
import type { MucusQuality, SymptoDay } from './symptothermal';

const BASE = new Date(2026, 0, 1);

/** Build a run of consecutive dated days from per-day temperature/mucus specs. */
function days(specs: Array<{ t?: number | null; m?: MucusQuality | null }>): SymptoDay[] {
  return specs.map((s, i) => ({ date: addDays(BASE, i), temperature: s.t ?? null, mucus: s.m ?? null }));
}

/** Six low readings followed by `highs`, as a temperature-only series. */
function tempSeries(low: number, highs: number[]): SymptoDay[] {
  return days([...Array(6).fill({ t: low }), ...highs.map((t) => ({ t }))]);
}

describe('evaluateTempShift', () => {
  it('confirms the regular 3-over-6 rule (3rd high >= 0.2 °C over the coverline)', () => {
    const shift = evaluateTempShift(tempSeries(36.4, [36.6, 36.7, 36.7]));
    expect(shift).not.toBeNull();
    expect(shift?.rule).toBe('regular');
    expect(shift?.coverline).toBe(36.4);
    expect(shift?.fhmDate).toEqual(addDays(BASE, 6));
    expect(shift?.ovulation).toEqual(addDays(BASE, 5)); // day before the FHM
    expect(shift?.confirmedDate).toEqual(addDays(BASE, 8)); // the 3rd high reading
  });

  it('falls back to the first exception (needs a 4th high) when 0.2 °C is not met', () => {
    const shift = evaluateTempShift(tempSeries(36.4, [36.5, 36.5, 36.5, 36.5]));
    expect(shift?.rule).toBe('first-exception');
    expect(shift?.confirmedDate).toEqual(addDays(BASE, 9));
  });

  it('tolerates a single dip via the second exception', () => {
    // high, dip below coverline, high, then a 4th reading >= 0.2 °C above.
    const shift = evaluateTempShift(tempSeries(36.4, [36.6, 36.3, 36.7, 36.8]));
    expect(shift?.rule).toBe('second-exception');
    expect(shift?.confirmedDate).toEqual(addDays(BASE, 9));
  });

  it('returns null without at least 6 prior readings', () => {
    expect(evaluateTempShift(tempSeries(36.4, []).slice(0, 5).concat({ ...days([{ t: 36.8 }])[0] }))).toBeNull();
  });

  it('returns null when no sustained rise occurs', () => {
    expect(evaluateTempShift(tempSeries(36.4, [36.4, 36.4, 36.4]))).toBeNull();
  });
});

describe('evaluateMucusPeak', () => {
  it('is the last most-fertile day followed by 3 drier days', () => {
    const peak = evaluateMucusPeak(
      days([
        { m: 'creamy' },
        { m: 'egg-white' },
        { m: 'egg-white' },
        { m: 'sticky' },
        { m: 'sticky' },
        { m: 'sticky' },
      ]),
    );
    expect(peak).toEqual(addDays(BASE, 2)); // the 2nd (last) egg-white day
  });

  it('returns null when the peak is not followed by 3 drier days', () => {
    expect(evaluateMucusPeak(days([{ m: 'egg-white' }, { m: 'sticky' }, { m: 'sticky' }]))).toBeNull();
  });

  it('ignores atypical mucus and returns null with no fertile-quality days', () => {
    expect(evaluateMucusPeak(days([{ m: 'atypical' }, { m: 'sticky' }, { m: 'sticky' }, { m: 'sticky' }]))).toBeNull();
  });
});

describe('symptothermal (double-check)', () => {
  it('confirms only when BOTH a temperature shift and a mucus peak exist', () => {
    // Temps: 6 lows (days 0-5), FHM day 6, regular shift confirmed day 8.
    // Mucus: creamy day 7, egg-white peak day 8, drying days 9-11.
    const cycle = days([
      { t: 36.4 },
      { t: 36.4 },
      { t: 36.4 },
      { t: 36.4 },
      { t: 36.4 },
      { t: 36.4 },
      { t: 36.6 },
      { t: 36.7, m: 'creamy' },
      { t: 36.7, m: 'egg-white' },
      { m: 'sticky' },
      { m: 'sticky' },
      { m: 'sticky' },
    ]);
    const result = symptothermal(cycle);
    expect(result.confirmed).toBe(true);
    expect(result.basis).toEqual({ temp: true, mucus: true });
    expect(result.ovulation).toEqual(addDays(BASE, 5)); // FHM day 6 − 1
    // Confirmation = later of temp-complete (day 8) and mucus peak (day 8) + 3 = day 11.
    expect(result.infertileFrom).toEqual(addDays(BASE, 11));
  });

  it('is not confirmed when only the temperature shift is present', () => {
    const result = symptothermal(tempSeries(36.4, [36.6, 36.7, 36.7]));
    expect(result.confirmed).toBe(false);
    expect(result.ovulation).toBeNull();
    expect(result.infertileFrom).toBeNull();
    expect(result.basis).toEqual({ temp: true, mucus: false });
  });

  it('is not confirmed for an empty cycle', () => {
    expect(symptothermal([])).toMatchObject({ confirmed: false, ovulation: null, basis: { temp: false, mucus: false } });
  });
});
