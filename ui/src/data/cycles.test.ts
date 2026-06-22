import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import {
  computePeriodDayIds,
  cycleDayNumber,
  cycleForDate,
  cycleOnset,
  flowPeriodLevelIds,
  nextPeriodEstimate,
} from './cycles';
import type { Category, CategoryLevel, Day } from './types';

function day(overrides: Partial<Day>): Day {
  return { id: 'd', cycleId: 'c', order: null, date: null, notes: null, ...overrides };
}

describe('cycleOnset', () => {
  it('is the earliest period day (by id) when period day ids are supplied', () => {
    const days = [
      day({ id: 'd3', date: new Date(2026, 0, 3) }),
      day({ id: 'd1', date: new Date(2026, 0, 1) }),
      day({ id: 'd0', date: new Date(2025, 11, 28) }),
    ];
    // d1 and d3 are period (flow >= Light); d0 (the earliest dated) is not.
    expect(cycleOnset(days, new Set(['d1', 'd3']))).toEqual(new Date(2026, 0, 1));
  });

  it('falls back to the earliest dated day when no period day ids are supplied', () => {
    const days = [day({ date: new Date(2026, 0, 5) }), day({ date: new Date(2026, 0, 2) })];
    expect(cycleOnset(days)).toEqual(new Date(2026, 0, 2));
    expect(cycleOnset(days, new Set())).toEqual(new Date(2026, 0, 2));
  });

  it('is null when the cycle has no dated days', () => {
    expect(cycleOnset([day({}), day({})])).toBeNull();
  });
});

describe('flow period detection', () => {
  const categories: Category[] = [
    { id: 'flow', userId: null, global: true, slug: 'flow', name: 'Flow', icon: '', color: '' },
    { id: 'pain', userId: null, global: true, slug: 'pain', name: 'Pain', icon: '', color: '' },
  ];
  const levels: CategoryLevel[] = [
    { id: 'spotting', categoryId: 'flow', order: 0, name: 'Spotting', icon: '' },
    { id: 'light', categoryId: 'flow', order: 1, name: 'Light', icon: '' },
    { id: 'heavy', categoryId: 'flow', order: 3, name: 'Heavy', icon: '' },
    { id: 'cramps', categoryId: 'pain', order: 0, name: 'Cramps', icon: '' },
  ];

  it('flowPeriodLevelIds returns flow levels at intensity >= Light (excludes spotting)', () => {
    expect(flowPeriodLevelIds(categories, levels)).toEqual(new Set(['light', 'heavy']));
  });

  it('computePeriodDayIds marks days carrying a period-level flow factor', () => {
    const factors = [
      { dayId: 'd1', categoryLevelId: 'light' }, // period
      { dayId: 'd2', categoryLevelId: 'spotting' }, // spotting only - not a period day
      { dayId: 'd3', categoryLevelId: 'cramps' }, // unrelated factor
    ];
    expect(computePeriodDayIds(factors, flowPeriodLevelIds(categories, levels))).toEqual(new Set(['d1']));
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
