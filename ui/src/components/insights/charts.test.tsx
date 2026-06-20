// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n'; // initialise the real i18next instance so t()/dates resolve
import { CycleLengthChart } from './CycleLengthChart';
import { SymptomPhaseChart } from './SymptomPhaseChart';
import type { CycleLengthPoint } from '@/data/insights';
import type { PhaseCounts } from '@/data/insights';

function point(overrides: Partial<CycleLengthPoint>): CycleLengthPoint {
  return {
    cycleId: 'c',
    onset: new Date(2026, 0, 1),
    length: 28,
    rollingAverage: 28,
    variability: 0,
    bandLow: 28,
    bandHigh: 28,
    plausible: true,
    ...overrides,
  };
}

describe('CycleLengthChart', () => {
  const points = [
    point({ onset: new Date(2026, 0, 1), length: 28, rollingAverage: 28, bandLow: 26, bandHigh: 30 }),
    point({ onset: new Date(2026, 1, 1), length: 30, rollingAverage: 29, bandLow: 27, bandHigh: 31 }),
    point({ onset: new Date(2026, 2, 1), length: 27, rollingAverage: 28, bandLow: 26, bandHigh: 30 }),
  ];

  it('renders one bar per cycle with no NaN geometry', () => {
    const { container } = render(<CycleLengthChart points={points} showBand />);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      for (const attr of ['x', 'y', 'width', 'height']) {
        expect(Number.isNaN(Number(r.getAttribute(attr)))).toBe(false);
      }
    }
  });

  it('draws the trend line and variability band when showBand is set', () => {
    const { container } = render(<CycleLengthChart points={points} showBand />);
    expect(container.querySelector('polyline')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('omits the trend line and band when showBand is false', () => {
    const { container } = render(<CycleLengthChart points={points} showBand={false} />);
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
    expect(container.querySelector('polygon')).not.toBeInTheDocument();
  });

  it('labels each bar with its length via i18n', () => {
    render(<CycleLengthChart points={points} showBand />);
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });
});

describe('SymptomPhaseChart', () => {
  const counts: PhaseCounts = { menstrual: 0, follicular: 1, ovulatory: 0, luteal: 2 };
  const phaseDayTotals: PhaseCounts = { menstrual: 2, follicular: 3, ovulatory: 2, luteal: 4 };
  const rows = [{ categoryId: 'pain', name: 'Pain', color: '#d14a4a', counts, total: 3 }];

  it('renders a column header per phase and a row per category', () => {
    render(<SymptomPhaseChart rows={rows} phaseDayTotals={phaseDayTotals} />);
    for (const phase of ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal']) {
      expect(screen.getByRole('columnheader', { name: phase })).toBeInTheDocument();
    }
    expect(screen.getByRole('rowheader', { name: 'Pain' })).toBeInTheDocument();
  });

  it('shows the per-phase counts and a descriptive cell label', () => {
    render(<SymptomPhaseChart rows={rows} phaseDayTotals={phaseDayTotals} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Pain: logged on 2 days in the Luteal phase.'),
    ).toBeInTheDocument();
  });
});
