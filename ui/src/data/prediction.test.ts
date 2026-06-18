import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import {
  cycleStats,
  forecastDayType,
  observedCycleLengths,
  predictFertileWindow,
  predictNextPeriod,
  predictPmsWindow,
} from './prediction';
import type { CycleStats } from './prediction';

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
