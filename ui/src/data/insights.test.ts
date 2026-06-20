import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { classifyPhase, cycleLengthHistory, symptomPhaseMatrix } from './insights';
import type { Day } from './types';

const BASE = new Date(2026, 0, 1);

/** Build a run of `{id, onset}` pairs from a base date and the gaps between
 * onsets. Ids are c0, c1, … in onset order. */
function onsetSeries(base: Date, gaps: number[]): { id: string; onset: Date }[] {
  const series = [{ id: 'c0', onset: base }];
  let cursor = base;
  gaps.forEach((gap, i) => {
    cursor = addDays(cursor, gap);
    series.push({ id: `c${i + 1}`, onset: cursor });
  });
  return series;
}

function day(overrides: Partial<Day>): Day {
  return { id: 'd', cycleId: 'c', order: null, date: null, notes: null, ...overrides };
}

describe('cycleLengthHistory', () => {
  it('pairs completed cycles oldest → newest, one point per gap', () => {
    const { points } = cycleLengthHistory(onsetSeries(BASE, [28, 30, 27]), 28);
    expect(points.map((p) => p.length)).toEqual([28, 30, 27]);
    // Each point is anchored at the earlier onset and names that cycle.
    expect(points.map((p) => p.cycleId)).toEqual(['c0', 'c1', 'c2']);
  });

  it('excludes the in-progress current cycle (n onsets → n−1 points)', () => {
    const { points } = cycleLengthHistory(onsetSeries(BASE, [28, 28]), 28);
    expect(points).toHaveLength(2);
  });

  it('sorts onsets before differencing (order-independent)', () => {
    const series = onsetSeries(BASE, [28, 30]);
    const { points } = cycleLengthHistory([...series].reverse(), 28);
    expect(points.map((p) => p.length)).toEqual([28, 30]);
  });

  it('marks an outlier gap implausible and excludes it from the trend', () => {
    // 28, 28, then a 120-day skip, then 28.
    const { points } = cycleLengthHistory(onsetSeries(BASE, [28, 28, 120, 28]), 28);
    const outlier = points[2]!;
    expect(outlier.length).toBe(120);
    expect(outlier.plausible).toBe(false);
    // The rolling average ignores the outlier - it stays at 28 (avg of 28,28).
    expect(outlier.rollingAverage).toBe(28);
    // The next plausible point's window is still [28,28,28], avg 28.
    expect(points[3]!.rollingAverage).toBe(28);
  });

  it('rolling average/variability is causal (point i uses only lengths ≤ i)', () => {
    const { points } = cycleLengthHistory(onsetSeries(BASE, [26, 30]), 28);
    // First point sees only [26]; second sees [26, 30].
    expect(points[0]!.rollingAverage).toBe(26);
    expect(points[0]!.variability).toBe(0);
    expect(points[1]!.rollingAverage).toBe(28);
    expect(points[1]!.variability).toBeCloseTo(Math.sqrt(8), 5); // sd of [26,30]
  });

  it('band collapses to the average when variability is 0', () => {
    const { points } = cycleLengthHistory(onsetSeries(BASE, [28]), 28);
    const p = points[0]!;
    expect(p.bandLow).toBe(p.rollingAverage);
    expect(p.bandHigh).toBe(p.rollingAverage);
  });

  it("stats.source flips from configured to learned once enough cycles exist", () => {
    // 2 gaps → 2 observed lengths → still below MIN_CYCLES_TO_LEARN (3).
    expect(cycleLengthHistory(onsetSeries(BASE, [28, 30]), 28).stats.source).toBe('configured');
    expect(cycleLengthHistory(onsetSeries(BASE, [28, 30, 27]), 28).stats.source).toBe('learned');
  });

  it('returns no points for empty, single, or all-null onsets', () => {
    expect(cycleLengthHistory([], 28).points).toEqual([]);
    expect(cycleLengthHistory([{ id: 'c0', onset: BASE }], 28).points).toEqual([]);
    expect(cycleLengthHistory([{ id: 'x', onset: null }], 28).points).toEqual([]);
  });
});

describe('classifyPhase', () => {
  const onset = BASE;
  const nextOnset = addDays(BASE, 28); // ovulation = day 14 from onset
  const args = (date: Date, extra: Partial<Parameters<typeof classifyPhase>[0]> = {}) =>
    classifyPhase({ date, onset, nextOnset, isPeriodDay: false, ...extra });

  it('a period day is menstrual regardless of position', () => {
    expect(args(addDays(onset, 20), { isPeriodDay: true })).toBe('menstrual');
  });

  it('ovulation day and the inclusive fertile-window edges are ovulatory', () => {
    const ovulation = addDays(nextOnset, -14); // day 14
    expect(args(ovulation)).toBe('ovulatory');
    expect(args(addDays(ovulation, -5))).toBe('ovulatory'); // fertileStart
    expect(args(addDays(ovulation, 1))).toBe('ovulatory'); // fertileEnd
  });

  it('before the fertile window is follicular, after it is luteal', () => {
    const ovulation = addDays(nextOnset, -14);
    expect(args(addDays(ovulation, -6))).toBe('follicular');
    expect(args(addDays(ovulation, 2))).toBe('luteal');
  });

  it('the averageLength path matches the nextOnset path', () => {
    const date = addDays(onset, 14);
    const viaNext = classifyPhase({ date, onset, nextOnset, isPeriodDay: false });
    const viaAvg = classifyPhase({ date, onset, averageLength: 28, isPeriodDay: false });
    expect(viaAvg).toBe(viaNext);
  });

  it('a date before the onset belongs to an earlier cycle (null)', () => {
    expect(args(addDays(onset, -1))).toBeNull();
  });

  it('returns null with neither nextOnset nor averageLength', () => {
    expect(classifyPhase({ date: addDays(onset, 5), onset, isPeriodDay: false })).toBeNull();
  });

  it('skips the ovulatory band when the cycle is too short for the luteal model', () => {
    const shortNext = addDays(onset, 10); // ovulation would precede onset
    const before = classifyPhase({ date: addDays(onset, 1), onset, nextOnset: shortNext, isPeriodDay: false });
    const after = classifyPhase({ date: addDays(onset, 8), onset, nextOnset: shortNext, isPeriodDay: false });
    expect(before).toBe('follicular');
    expect(after).toBe('luteal');
  });
});

describe('symptomPhaseMatrix', () => {
  // Two completed cycles of 28 days starting at BASE and BASE+28.
  const onsets = onsetSeries(BASE, [28, 28]);
  const categories = [
    { id: 'flow', slug: 'flow' },
    { id: 'bbt', slug: 'bbt' },
    { id: 'pain', slug: 'pain' },
    { id: 'custom', slug: null },
  ];
  const levels = [
    { id: 'flow-light', categoryId: 'flow' },
    { id: 'bbt-reading', categoryId: 'bbt' },
    { id: 'cramps', categoryId: 'pain' },
    { id: 'headache', categoryId: 'pain' },
    { id: 'custom-a', categoryId: 'custom' },
  ];

  it('buckets a Pain factor onto the phase of its day (luteal)', () => {
    // Day 22 of cycle c0 is luteal (after the fertile window).
    const lutealDay = day({ id: 'dx', date: addDays(BASE, 21) });
    const matrix = symptomPhaseMatrix({
      days: [lutealDay],
      factors: [{ dayId: 'dx', categoryLevelId: 'cramps' }],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    const pain = matrix.categories.find((c) => c.categoryId === 'pain');
    expect(pain?.counts.luteal).toBe(1);
  });

  it('excludes Flow and BBT by slug but includes custom (slug-less) categories', () => {
    const d = day({ id: 'dx', date: addDays(BASE, 21) });
    const matrix = symptomPhaseMatrix({
      days: [d],
      factors: [
        { dayId: 'dx', categoryLevelId: 'flow-light' },
        { dayId: 'dx', categoryLevelId: 'bbt-reading' },
        { dayId: 'dx', categoryLevelId: 'custom-a' },
      ],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    const ids = matrix.categories.map((c) => c.categoryId);
    expect(ids).toContain('custom');
    expect(ids).not.toContain('flow');
    expect(ids).not.toContain('bbt');
  });

  it('category total is the sum of its level totals, levels desc by total', () => {
    const d1 = day({ id: 'd1', date: addDays(BASE, 21) });
    const d2 = day({ id: 'd2', date: addDays(BASE, 22) });
    const matrix = symptomPhaseMatrix({
      days: [d1, d2],
      factors: [
        { dayId: 'd1', categoryLevelId: 'cramps' },
        { dayId: 'd2', categoryLevelId: 'cramps' },
        { dayId: 'd1', categoryLevelId: 'headache' },
      ],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    const pain = matrix.categories.find((c) => c.categoryId === 'pain')!;
    expect(pain.total).toBe(3);
    expect(pain.levels.map((l) => l.categoryLevelId)).toEqual(['cramps', 'headache']);
  });

  it('counts a factor-less classified day in phaseDayTotals only', () => {
    const d = day({ id: 'dx', date: addDays(BASE, 21) });
    const matrix = symptomPhaseMatrix({
      days: [d],
      factors: [],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(matrix.phaseDayTotals.luteal).toBe(1);
    expect(matrix.categories).toEqual([]);
  });

  it('counts a level logged twice on one day only once', () => {
    const d = day({ id: 'dx', date: addDays(BASE, 21) });
    const matrix = symptomPhaseMatrix({
      days: [d],
      factors: [
        { dayId: 'dx', categoryLevelId: 'cramps' },
        { dayId: 'dx', categoryLevelId: 'cramps' },
      ],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(matrix.categories.find((c) => c.categoryId === 'pain')?.total).toBe(1);
  });

  it('counts a day before any onset as unclassified', () => {
    const early = day({ id: 'dx', date: addDays(BASE, -5) });
    const matrix = symptomPhaseMatrix({
      days: [early],
      factors: [{ dayId: 'dx', categoryLevelId: 'cramps' }],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(matrix.unclassifiedDays).toBe(1);
    expect(matrix.categories).toEqual([]);
  });

  it('skips days with no date', () => {
    const matrix = symptomPhaseMatrix({
      days: [day({ id: 'dx', date: null })],
      factors: [{ dayId: 'dx', categoryLevelId: 'cramps' }],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(matrix.unclassifiedDays).toBe(0);
    expect(matrix.categories).toEqual([]);
  });

  it('always exposes all four phase keys in counts', () => {
    const d = day({ id: 'dx', date: addDays(BASE, 21) });
    const matrix = symptomPhaseMatrix({
      days: [d],
      factors: [{ dayId: 'dx', categoryLevelId: 'cramps' }],
      categories,
      levels,
      onsets,
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(Object.keys(matrix.categories[0]!.counts).sort()).toEqual(
      ['follicular', 'luteal', 'menstrual', 'ovulatory'],
    );
  });

  it('returns empty/zeroed structures for empty inputs', () => {
    const matrix = symptomPhaseMatrix({
      days: [],
      factors: [],
      categories,
      levels,
      onsets: [],
      periodDayIds: new Set(),
      averageLength: 28,
    });
    expect(matrix.categories).toEqual([]);
    expect(matrix.phaseDayTotals).toEqual({ menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 });
    expect(matrix.unclassifiedDays).toBe(0);
  });
});
