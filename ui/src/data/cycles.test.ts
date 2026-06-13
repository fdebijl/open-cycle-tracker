import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { cycleDayNumber, cycleForDate, cycleOnset, nextPeriodEstimate } from './cycles';
import type { Day } from './types';

function day(overrides: Partial<Day>): Day {
  return { id: 'd', cycleId: 'c', order: null, date: null, dayType: 'none', ...overrides };
}

describe('cycleOnset', () => {
  it('is the earliest period day when any are tracked', () => {
    const days = [
      day({ date: new Date(2026, 0, 3), dayType: 'period' }),
      day({ date: new Date(2026, 0, 1), dayType: 'period' }),
      day({ date: new Date(2025, 11, 28), dayType: 'none' }),
    ];
    expect(cycleOnset(days)).toEqual(new Date(2026, 0, 1));
  });

  it('falls back to the earliest dated day when no period is tracked', () => {
    const days = [day({ date: new Date(2026, 0, 5) }), day({ date: new Date(2026, 0, 2), dayType: 'pms' })];
    expect(cycleOnset(days)).toEqual(new Date(2026, 0, 2));
  });

  it('is null when the cycle has no dated days', () => {
    expect(cycleOnset([day({}), day({})])).toBeNull();
  });
});

describe('cycleDayNumber', () => {
  it('is 1-based from the onset', () => {
    const onset = new Date(2026, 0, 1);
    expect(cycleDayNumber(onset, onset)).toBe(1);
    expect(cycleDayNumber(new Date(2026, 0, 5), onset)).toBe(5);
  });
});

describe('cycleForDate', () => {
  const cycles = [
    { id: 'a', onset: new Date(2026, 0, 1) },
    { id: 'b', onset: new Date(2026, 1, 1) },
  ];

  it('picks the latest cycle whose onset is on or before the date', () => {
    expect(cycleForDate(new Date(2026, 0, 15), cycles, 'b')).toBe('a');
    expect(cycleForDate(new Date(2026, 1, 5), cycles, 'b')).toBe('b');
    expect(cycleForDate(new Date(2026, 1, 1), cycles, 'b')).toBe('b');
  });

  it('falls back to the current cycle for dates before every onset', () => {
    expect(cycleForDate(new Date(2025, 11, 1), cycles, 'b')).toBe('b');
  });

  it('ignores cycles without an onset', () => {
    const withNull = [{ id: 'x', onset: null }, { id: 'a', onset: new Date(2026, 0, 1) }];
    expect(cycleForDate(new Date(2026, 0, 2), withNull, 'x')).toBe('a');
  });
});

describe('nextPeriodEstimate', () => {
  it('is onset + average cycle length', () => {
    const onset = subDays(new Date(), 5);
    const est = nextPeriodEstimate(onset, 28);
    expect(est.date).toEqual(addDays(onset, 28));
    expect(est.daysUntil).toBe(23);
  });

  it('reports an overdue period as negative days', () => {
    expect(nextPeriodEstimate(subDays(new Date(), 40), 28).daysUntil).toBe(-12);
  });

  it('returns nulls when the onset is unknown', () => {
    expect(nextPeriodEstimate(null, 28)).toEqual({ date: null, daysUntil: null });
  });
});
