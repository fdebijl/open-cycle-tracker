import { useMemo, useRef } from 'react';
import { addDays, isSameDay } from 'date-fns';
import { useResponsive } from '@/hooks/useResponsive';
import { cycleDayNumber, nextPeriodEstimate } from '@/data/cycles';
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
 * onset + average cycle length (the simple next-period estimate). */
function countdownLabel(daysUntil: number | null): string {
  if (daysUntil === null) return '';
  if (daysUntil < 0) return `Your period is ${Math.abs(daysUntil)} days late`;
  if (daysUntil === 0) return 'Your period may start today';
  if (daysUntil === 1) return 'Your period may start tomorrow';
  return `${daysUntil} days until next period`;
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
  averageCycleLength,
  includeFuture = false,
  onSelectDay,
  onLogDate,
}: {
  days: Day[];
  cycleStart: Date | null;
  averageCycleLength: number;
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
    const base = includeFuture ? Math.max(averageCycleLength, todayNumber) : 0;
    const slotCount = Math.max(1, maxLogged, base);

    return Array.from({ length: slotCount }, (_unused, i) => {
      const date = addDays(cycleStart, i);
      return { dayNumber: i + 1, date, day: dated.find((d) => isSameDay(d.date as Date, date)) };
    });
  }, [days, cycleStart, averageCycleLength, includeFuture]);

  const { daysUntil } = nextPeriodEstimate(cycleStart, averageCycleLength);

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
          return (
            <DayMarker
              key={slot.dayNumber}
              day={slot.day}
              date={slot.date}
              dayNumber={slot.dayNumber}
              style={{ left: x, top: y }}
              onSelect={() => (slot.day ? onSelectDay(slot.day) : onLogDate(slot.date))}
            />
          );
        })}
        <p className={styles.countdown}>{countdownLabel(daysUntil)}</p>
      </div>
    </div>
  );
}
