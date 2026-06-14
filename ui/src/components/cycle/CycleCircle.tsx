import { useMemo, useRef } from 'react';
import { addDays, isSameDay } from 'date-fns';
import { useResponsive } from '@/hooks/useResponsive';
import { cycleDayNumber } from '@/data/cycles';
import { forecastDayType, predictNextPeriod } from '@/data/prediction';
import type { CycleStats, FertilePrediction } from '@/data/prediction';
import type { Day } from '@/data/types';
import { DayMarker } from './DayMarker';
import { useProximityScaler } from './useProximityScaler';
import styles from './CycleCircle.module.scss';

interface Slot {
  dayNumber: number;
  date: Date;
  day?: Day;
}

/** Human label for the countdown shown at the circle's center, derived from the
 * predicted next-period date. `margin` is the ± confidence band in days (from a
 * learned average's variability); 0 hides it. */
function countdownLabel(daysUntil: number | null, margin: number): string {
  if (daysUntil === null) return '';
  const band = margin > 0 ? ` (±${margin})` : '';
  if (daysUntil < 0) return `Your period is ${Math.abs(daysUntil)} days late`;
  if (daysUntil === 0) return 'Your period may start today';
  if (daysUntil === 1) return 'Your period may start tomorrow';
  return `${daysUntil} days until next period${band}`;
}

/**
 * Renders a cycle as dots evenly spaced around a circle, day 1 (the onset) at
 * the top going clockwise. Slots run from the onset out to at least the average
 * cycle length (for the current cycle) or the last logged day (for a past one).
 * Logged days are filled and colored by type; empty slots are tappable to log
 * that date on demand. A next-period countdown sits in the center.
 */
export function CycleCircle({
  days,
  cycleStart,
  stats,
  fertile,
  periodDayIds,
  includeFuture = false,
  onSelectDay,
  onLogDate,
}: {
  days: Day[];
  cycleStart: Date | null;
  stats: CycleStats;
  fertile?: FertilePrediction;
  /** Day ids that carry a period-level Flow factor (drives period coloring). */
  periodDayIds: Set<string>;
  includeFuture?: boolean;
  onSelectDay: (day: Day) => void;
  onLogDate: (date: Date) => void;
}) {
  const { width, height } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  useProximityScaler(containerRef);

  const slots = useMemo<Slot[]>(() => {
    if (!cycleStart) return [];
    const dated = days.filter((d) => d.date);
    const maxLogged = dated.reduce((max, d) => Math.max(max, cycleDayNumber(d.date as Date, cycleStart)), 1);
    const todayNumber = includeFuture ? cycleDayNumber(new Date(), cycleStart) : 0;
    const base = includeFuture ? Math.max(stats.averageLength, todayNumber) : 0;
    const slotCount = Math.max(1, maxLogged, base);

    return Array.from({ length: slotCount }, (_unused, i) => {
      const date = addDays(cycleStart, i);
      return { dayNumber: i + 1, date, day: dated.find((d) => isSameDay(d.date as Date, date)) };
    });
  }, [days, cycleStart, stats.averageLength, includeFuture]);

  const { daysUntil } = predictNextPeriod(cycleStart, stats);
  const margin = Math.round(stats.variability);

  const size = Math.max(220, Math.min(width || 360, height || 360) * 0.6);
  const center = size / 2;
  const radius = center * 0.82;
  const n = slots.length || 1;

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.circle} style={{ width: size, height: size }}>
        {slots.map((slot, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const forecast = !slot.day && includeFuture && fertile ? forecastDayType(slot.date, fertile) : null;
          return (
            <DayMarker
              key={slot.dayNumber}
              day={slot.day}
              isPeriod={slot.day ? periodDayIds.has(slot.day.id) : false}
              date={slot.date}
              dayNumber={slot.dayNumber}
              forecast={forecast ?? undefined}
              style={{ left: x, top: y }}
              onSelect={() => (slot.day ? onSelectDay(slot.day) : onLogDate(slot.date))}
            />
          );
        })}
        <p className={styles.countdown}>{countdownLabel(daysUntil, margin)}</p>
      </div>
    </div>
  );
}
