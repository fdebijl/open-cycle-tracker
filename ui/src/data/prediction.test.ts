import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import {
  classifyMenopausalStage,
  cycleLengthDifferences,
  cycleStats,
  flagSkippedCycles,
  forecastDayType,
  forecastMarkerEnabled,
  medianCld,
  observedCycleLengths,
  PERI_MIN_WINDOW_MARGIN,
  predictFertileWindow,
  predictNextPeriod,
  predictPmsWindow,
  refineFertileWindow,
} from './prediction';
import type { CycleStats } from './prediction';
import type { SymptothermalResult } from './symptothermal';
import { DEFAULT_CYCLE_MARKERS } from './types';

/** Build a run of onsets from a base date and the gaps between them. */
function onsetsFromGaps(base: Date, gaps: number[]): Date[] {
  const onsets = [base];
  let cursor = base;
  for (const gap of gaps) {
    cursor = addDays(cursor, gap);
    onsets.push(cursor);
  }
  return onsets;
}

const BASE = new Date(2026, 0, 1);

describe('observedCycleLengths', () => {
  it('is the onset-to-onset gaps, oldest to newest', () => {
    expect(observedCycleLengths(onsetsFromGaps(BASE, [28, 30, 27]))).toEqual([28, 30, 27]);
  });

  it('sorts onsets before differencing (order-independent)', () => {
    const onsets = onsetsFromGaps(BASE, [28, 30]);
    expect(observedCycleLengths([...onsets].reverse())).toEqual([28, 30]);
  });

  it('yields one fewer length than onsets (the latest onset has no successor)', () => {
    expect(observedCycleLengths(onsetsFromGaps(BASE, [28, 28, 28]))).toHaveLength(3);
  });

  it('drops implausible gaps (skipped/late period, retroactive insert)', () => {
    // gaps: 28 (ok), 120 (skipped - too long), 10 (too short), 29 (ok)
    expect(observedCycleLengths(onsetsFromGaps(BASE, [28, 120, 10, 29]))).toEqual([28, 29]);
  });

  it('is empty with fewer than two onsets', () => {
    expect(observedCycleLengths([])).toEqual([]);
    expect(observedCycleLengths([BASE])).toEqual([]);
  });
});

describe('cycleStats', () => {
  it('falls back to the configured average below the learning threshold', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [30, 30]), 28); // only 2 observed lengths
    expect(stats).toMatchObject({ averageLength: 28, source: 'configured', variability: 0, sampleSize: 0 });
    expect(stats.observedLengths).toEqual([30, 30]);
  });

  it('learns the rounded average once enough history exists', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [28, 30, 27, 28]), 26); // 4 lengths, mean 28.25
    expect(stats.source).toBe('learned');
    expect(stats.averageLength).toBe(28);
    expect(stats.sampleSize).toBe(4);
    expect(stats.variability).toBeGreaterThan(0);
  });

  it('averages only the most recent ROLLING_WINDOW lengths', () => {
    // 8 lengths; the oldest two (40, 40) should be excluded so they don't drag the mean up.
    const stats = cycleStats(onsetsFromGaps(BASE, [40, 40, 28, 28, 28, 28, 28, 28]), 28);
    expect(stats.sampleSize).toBe(6);
    expect(stats.averageLength).toBe(28);
    expect(stats.variability).toBe(0);
  });
});

const learnedStats: CycleStats = {
  observedLengths: [27, 31, 29],
  averageLength: 29,
  variability: 2,
  sampleSize: 3,
  source: 'learned',
  confidence: 'high',
  skippedCycleCount: 0,
  longestRecentGap: 31,
  medianCld: 2,
  isHighlyVariable: false,
  skippedCount: 0,
};

describe('predictNextPeriod', () => {
  it('adds a ± rounded-variability band around the predicted date', () => {
    const onset = new Date(2026, 2, 1);
    const pred = predictNextPeriod(onset, learnedStats);
    expect(pred.date).toEqual(addDays(onset, 29));
    expect(pred.windowStart).toEqual(addDays(onset, 27));
    expect(pred.windowEnd).toEqual(addDays(onset, 31));
  });

  it('collapses the window to the date when there is no variability', () => {
    const onset = new Date(2026, 2, 1);
    const pred = predictNextPeriod(onset, { ...learnedStats, variability: 0 });
    expect(pred.windowStart).toEqual(pred.date);
    expect(pred.windowEnd).toEqual(pred.date);
  });

  it('returns nulls when the onset is unknown', () => {
    expect(predictNextPeriod(null, learnedStats)).toMatchObject({ date: null, windowStart: null, windowEnd: null });
  });
});

describe('predictFertileWindow', () => {
  it('counts the luteal phase back from the predicted next onset', () => {
    const onset = new Date(2026, 2, 1);
    const { ovulation, fertileStart, fertileEnd } = predictFertileWindow(onset, learnedStats);
    // next onset = onset + 29; ovulation = next onset - 14 = onset + 15
    expect(ovulation).toEqual(addDays(onset, 15));
    expect(fertileStart).toEqual(addDays(onset, 10)); // ovulation - 5
    expect(fertileEnd).toEqual(addDays(onset, 16)); // ovulation + 1
  });

  it('returns nulls when the onset is unknown', () => {
    expect(predictFertileWindow(null, learnedStats)).toEqual({ ovulation: null, fertileStart: null, fertileEnd: null });
  });

  it('returns nulls when the average is too short for the luteal model', () => {
    expect(predictFertileWindow(new Date(2026, 2, 1), { ...learnedStats, averageLength: 14 })).toEqual({
      ovulation: null,
      fertileStart: null,
      fertileEnd: null,
    });
  });
});

describe('predictPmsWindow', () => {
  const onset = new Date(2026, 2, 1);

  it('spans the PMS_DAYS leading up to the predicted next onset', () => {
    const { pmsStart, pmsEnd } = predictPmsWindow(onset, learnedStats); // next onset = onset+29
    expect(pmsStart).toEqual(addDays(onset, 24)); // next onset - 5
    expect(pmsEnd).toEqual(addDays(onset, 28)); // next onset - 1 (day before onset)
  });

  it('returns nulls when the onset is unknown', () => {
    expect(predictPmsWindow(null, learnedStats)).toEqual({ pmsStart: null, pmsEnd: null });
  });

  it('returns nulls when the average is only configured (not enough history)', () => {
    const configured: CycleStats = { ...learnedStats, source: 'configured' };
    expect(predictPmsWindow(onset, configured)).toEqual({ pmsStart: null, pmsEnd: null });
  });

  it('returns nulls when variability is too wide to trust', () => {
    expect(predictPmsWindow(onset, { ...learnedStats, variability: 5 })).toEqual({ pmsStart: null, pmsEnd: null });
  });

  it('returns nulls when the cycle is too short to fit the window after the luteal phase', () => {
    // LUTEAL_PHASE_DAYS (14) + PMS_DAYS (5) = 19; an average of 19 leaves no room.
    expect(predictPmsWindow(onset, { ...learnedStats, averageLength: 19 })).toEqual({ pmsStart: null, pmsEnd: null });
  });
});

describe('forecastDayType', () => {
  const onset = new Date(2026, 2, 1);
  const fertile = predictFertileWindow(onset, learnedStats); // ovulation onset+15, window onset+10..+16
  const pms = predictPmsWindow(onset, learnedStats); // window onset+24..+28

  it('tags the ovulation day', () => {
    expect(forecastDayType(addDays(onset, 15), fertile)).toBe('ovulation');
  });

  it('tags days inside the fertile window', () => {
    expect(forecastDayType(addDays(onset, 10), fertile)).toBe('fertile');
    expect(forecastDayType(addDays(onset, 16), fertile)).toBe('fertile');
  });

  it('tags days inside the PMS window when a pms prediction is supplied', () => {
    expect(forecastDayType(addDays(onset, 24), fertile, pms)).toBe('pms');
    expect(forecastDayType(addDays(onset, 28), fertile, pms)).toBe('pms');
  });

  it('ignores the PMS window when no pms prediction is supplied', () => {
    expect(forecastDayType(addDays(onset, 24), fertile)).toBeNull();
  });

  it('is null outside the window', () => {
    expect(forecastDayType(addDays(onset, 9), fertile)).toBeNull();
    expect(forecastDayType(addDays(onset, 17), fertile)).toBeNull();
  });

  it('is null when there is no forecast', () => {
    expect(forecastDayType(onset, { ovulation: null, fertileStart: null, fertileEnd: null })).toBeNull();
  });
});

describe('cycleStats - perimenopause mode', () => {
  it('leaves standard mode untouched: always high confidence, no skip signals', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [28, 30, 27, 28]), 28);
    expect(stats).toMatchObject({ confidence: 'high', skippedCycleCount: 0 });
  });

  it('downgrades to low confidence when recent cycles are highly variable', () => {
    // lengths 22,38,24,40 > std-dev ≈ 9 (>= LOW_CONFIDENCE_VARIABILITY)
    const stats = cycleStats(onsetsFromGaps(BASE, [22, 38, 24, 40]), 28, { mode: 'perimenopause', asOf: BASE });
    expect(stats.source).toBe('learned');
    expect(stats.confidence).toBe('low');
  });

  it('stays high confidence when peri cycles are still regular', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [28, 28, 28]), 28, { mode: 'perimenopause', asOf: BASE });
    expect(stats.confidence).toBe('high');
  });

  it('treats a long gap as a skipped cycle - excluded from the average, surfaced as a signal', () => {
    const onsets = onsetsFromGaps(BASE, [28, 70, 28, 28]); // last onset = BASE + 154
    const stats = cycleStats(onsets, 28, { mode: 'perimenopause', asOf: addDays(BASE, 159) });
    // 70 is a skip (>=60), so it never enters the learned average…
    expect(stats.observedLengths).toEqual([28, 28, 28]);
    // …but it counts as a skip and shows up as the longest recent gap.
    expect(stats.skippedCycleCount).toBe(1);
    expect(stats.longestRecentGap).toBe(70);
    expect(stats.confidence).toBe('low');
  });

  it('is unknown confidence during an open amenorrhea (current cycle past the skip threshold)', () => {
    const onsets = onsetsFromGaps(BASE, [28, 28, 28]); // last onset = BASE + 84
    const stats = cycleStats(onsets, 28, { mode: 'perimenopause', asOf: addDays(BASE, 154) }); // 70 days since
    expect(stats.confidence).toBe('unknown');
    expect(stats.skippedCycleCount).toBe(1);
  });

  it('postmenopause is always unknown confidence', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [28, 28, 28]), 28, { mode: 'postmenopause', asOf: BASE });
    expect(stats.confidence).toBe('unknown');
  });
});

describe('predictNextPeriod - confidence handling', () => {
  const onset = new Date(2026, 2, 1);

  it('returns nulls (an explicit "unknown") when confidence is unknown', () => {
    expect(predictNextPeriod(onset, { ...learnedStats, confidence: 'unknown' })).toMatchObject({
      date: null,
      daysUntil: null,
      windowStart: null,
      windowEnd: null,
    });
  });

  it('floors the band to a minimum width when confidence is low', () => {
    const pred = predictNextPeriod(onset, { ...learnedStats, confidence: 'low', variability: 2 });
    // variability would give ±2, but a low-confidence band is never tighter than the floor.
    expect(pred.windowStart).toEqual(addDays(pred.date as Date, -PERI_MIN_WINDOW_MARGIN));
    expect(pred.windowEnd).toEqual(addDays(pred.date as Date, PERI_MIN_WINDOW_MARGIN));
  });
});

describe('predictFertileWindow - confidence gating', () => {
  const onset = new Date(2026, 2, 1);

  it('is suppressed unless confidence is high (calendar method assumes regularity)', () => {
    expect(predictFertileWindow(onset, { ...learnedStats, confidence: 'low' })).toEqual({
      ovulation: null,
      fertileStart: null,
      fertileEnd: null,
    });
  });
});

describe('classifyMenopausalStage', () => {
  it('is reproductive for regular cycles with no amenorrhea', () => {
    const onsets = onsetsFromGaps(BASE, [28, 28, 28]);
    expect(classifyMenopausalStage(onsets, addDays(BASE, 89)).stage).toBe('reproductive');
  });

  it('flags early transition on persistent >=7-day swings between consecutive cycles', () => {
    const onsets = onsetsFromGaps(BASE, [28, 36, 28, 36]); // consecutive diffs all 8
    const staging = classifyMenopausalStage(onsets, addDays(BASE, 133));
    expect(staging.stage).toBe('early-transition');
    expect(staging.signals.persistent7DayDiff).toBe(true);
  });

  it('flags late transition on a >=60-day gap', () => {
    const onsets = onsetsFromGaps(BASE, [28, 65]);
    const staging = classifyMenopausalStage(onsets, addDays(BASE, 98));
    expect(staging.stage).toBe('late-transition');
    expect(staging.signals.amenorrhea60Plus).toBe(true);
  });

  it('flags postmenopause after 12 months of amenorrhea (even from a single onset)', () => {
    const staging = classifyMenopausalStage([BASE], addDays(BASE, 400));
    expect(staging.stage).toBe('postmenopause');
    expect(staging.signals.amenorrhea12mo).toBe(true);
  });

  it('is indeterminate with no onsets', () => {
    expect(classifyMenopausalStage([], BASE).stage).toBe('indeterminate');
  });
});

describe('cycleLengthDifferences', () => {
  it('is the absolute difference between consecutive lengths', () => {
    expect(cycleLengthDifferences([28, 30, 27, 28])).toEqual([2, 3, 1]);
  });

  it('is empty for fewer than two lengths', () => {
    expect(cycleLengthDifferences([28])).toEqual([]);
    expect(cycleLengthDifferences([])).toEqual([]);
  });
});

describe('medianCld', () => {
  it('takes the median of the CLDs (odd count)', () => {
    expect(medianCld([28, 30, 27, 28])).toBe(2); // CLDs [2,3,1] -> sorted [1,2,3] -> 2
  });

  it('averages the two middle CLDs (even count)', () => {
    expect(medianCld([28, 30, 33, 35, 30])).toBe(2.5); // CLDs [2,3,2,5] -> sorted [2,2,3,5] -> (2+3)/2
  });

  it('is 0 with fewer than two lengths (no CLD)', () => {
    expect(medianCld([28])).toBe(0);
  });
});

describe('flagSkippedCycles', () => {
  it('flags a single long gap among regular cycles exactly once', () => {
    const flags = flagSkippedCycles([28, 28, 60, 28, 28], 0); // threshold 0+10
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ index: 2, length: 60 });
  });

  it('does not over-flag a uniformly variable user', () => {
    // Alternating 25/45: every CLD is 20, but the median CLD is also 20, so the
    // 10-day excess threshold (30) is never exceeded.
    expect(flagSkippedCycles([25, 45, 25, 45], 20)).toEqual([]);
  });
});

describe('cycleStats - variability fields', () => {
  it('reports medianCld and is not highly variable for regular cycles', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [28, 30, 27, 28]), 26);
    expect(stats.medianCld).toBe(2);
    expect(stats.isHighlyVariable).toBe(false);
    expect(stats.skippedCount).toBe(0);
  });

  it('flags a consistently highly variable user (median CLD > 9)', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [25, 45, 25, 45, 25]), 28);
    expect(stats.medianCld).toBeGreaterThan(9);
    expect(stats.isHighlyVariable).toBe(true);
  });

  it('leaves the new fields zeroed when falling back to the configured average', () => {
    const stats = cycleStats(onsetsFromGaps(BASE, [30, 30]), 28); // below the learning threshold
    expect(stats).toMatchObject({ source: 'configured', medianCld: 0, isHighlyVariable: false, skippedCount: 0 });
  });
});

describe('predictNextPeriod - CLD-aware band', () => {
  const onset = new Date(2026, 2, 1);

  it('widens the band to the median CLD for highly variable users', () => {
    const stats: CycleStats = { ...learnedStats, variability: 2, medianCld: 8, isHighlyVariable: true };
    const pred = predictNextPeriod(onset, stats);
    expect(pred.windowStart).toEqual(addDays(pred.date as Date, -8));
    expect(pred.windowEnd).toEqual(addDays(pred.date as Date, 8));
  });

  it('never narrows below the std-dev when not highly variable', () => {
    const stats: CycleStats = { ...learnedStats, variability: 3, medianCld: 8, isHighlyVariable: false };
    const pred = predictNextPeriod(onset, stats);
    expect(pred.windowStart).toEqual(addDays(pred.date as Date, -3));
  });

  it('caps the margin at half the average length', () => {
    const stats: CycleStats = { ...learnedStats, averageLength: 30, variability: 2, medianCld: 40, isHighlyVariable: true };
    const pred = predictNextPeriod(onset, stats);
    expect(pred.windowStart).toEqual(addDays(pred.date as Date, -15)); // capped at floor(30/2)
  });
});

describe('refineFertileWindow', () => {
  const onset = new Date(2026, 2, 1);
  const predicted = predictFertileWindow(onset, learnedStats); // forward ovulation onset+15

  it('returns the forecast unchanged when there is no symptothermal result', () => {
    expect(refineFertileWindow(predicted, null)).toEqual(predicted);
  });

  it('returns the forecast unchanged when ovulation is not confirmed', () => {
    const sympto: SymptothermalResult = {
      confirmed: false,
      ovulation: null,
      infertileFrom: null,
      basis: { temp: true, mucus: false },
    };
    expect(refineFertileWindow(predicted, sympto)).toEqual(predicted);
  });

  it('supersedes the forward estimate with the confirmed ovulation and narrows the window', () => {
    const confirmedOvulation = new Date(2026, 2, 12);
    const infertileFrom = new Date(2026, 2, 14);
    const sympto: SymptothermalResult = {
      confirmed: true,
      ovulation: confirmedOvulation,
      infertileFrom,
      basis: { temp: true, mucus: true },
    };
    const refined = refineFertileWindow(predicted, sympto);
    expect(refined.confirmed).toBe(true);
    expect(refined.confirmedOvulation).toEqual(confirmedOvulation);
    expect(refined.ovulation).toEqual(confirmedOvulation);
    expect(refined.fertileStart).toEqual(addDays(confirmedOvulation, -5));
    expect(refined.fertileEnd).toEqual(infertileFrom);
  });
});

describe('forecastDayType / forecastMarkerEnabled - confirmed ovulation', () => {
  const onset = new Date(2026, 2, 1);
  const confirmedOvulation = new Date(2026, 2, 12);
  const refined = refineFertileWindow(predictFertileWindow(onset, learnedStats), {
    confirmed: true,
    ovulation: confirmedOvulation,
    infertileFrom: new Date(2026, 2, 14),
    basis: { temp: true, mucus: true },
  });

  it('labels the confirmed ovulation day distinctly and with precedence', () => {
    expect(forecastDayType(confirmedOvulation, refined)).toBe('ovulation-confirmed');
  });

  it('maps the confirmed label to the ovulation marker toggle', () => {
    expect(forecastMarkerEnabled('ovulation-confirmed', { ...DEFAULT_CYCLE_MARKERS, ovulation: true })).toBe(true);
    expect(forecastMarkerEnabled('ovulation-confirmed', { ...DEFAULT_CYCLE_MARKERS, ovulation: false })).toBe(false);
  });
});
