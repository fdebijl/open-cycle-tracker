import { useRef } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useResponsive } from '@/hooks/useResponsive';
import type { Day } from '@/data/types';
import { DayMarker } from './DayMarker';
import { useProximityScaler } from './useProximityScaler';
import styles from './CycleCircle.module.scss';

/** Human label for the countdown shown at the circle's center, derived from the
 * last day's date (matches the Ember `daysUntilNextPeriodLabel`). */
function countdownLabel(days: Day[]): string {
  const last = days[days.length - 1];
  if (!last?.date) return '';
  const remaining = differenceInCalendarDays(last.date, new Date());
  if (remaining < 0) return `Your period is ${Math.abs(remaining)} days late`;
  if (remaining === 0) return 'Your period may start today';
  if (remaining === 1) return 'Your period may start tomorrow';
  return `${remaining} days until next period`;
}

/** Renders the cycle's days as dots evenly spaced around a circle, day 1 at the
 * top going clockwise, with a countdown label in the center. */
export function CycleCircle({ days, onSelectDay }: { days: Day[]; onSelectDay: (day: Day) => void }) {
  const { width, height } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  useProximityScaler(containerRef);

  const sorted = [...days].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const n = sorted.length || 1;

  const size = Math.max(220, Math.min(width || 360, height || 360) * 0.6);
  const center = size / 2;
  const radius = center * 0.82;

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.circle} style={{ width: size, height: size }}>
        {sorted.map((day, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return <DayMarker key={day.id} day={day} style={{ left: x, top: y }} onSelect={() => onSelectDay(day)} />;
        })}
        <p className={styles.countdown}>{countdownLabel(sorted)}</p>
      </div>
    </div>
  );
}
