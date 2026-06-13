import { isToday } from 'date-fns';
import type { CSSProperties } from 'react';
import type { Day } from '@/data/types';
import styles from './DayMarker.module.scss';

/** A single slot dot positioned around the cycle circle. A logged `day` is
 * colored by its type; an unlogged slot renders empty (tappable to log that
 * date). An in-place ring marks today. The day number fades in when the marker
 * is scaled up by the proximity scaler. */
export function DayMarker({
  day,
  date,
  dayNumber,
  style,
  onSelect,
}: {
  day?: Day;
  date: Date;
  dayNumber: number;
  style?: CSSProperties;
  onSelect?: () => void;
}) {
  const today = isToday(date);
  return (
    <div
      data-day-marker
      data-daytype={day?.dayType ?? 'none'}
      data-today={today ? '1' : undefined}
      data-empty={day ? undefined : '1'}
      data-scaled="0"
      className={styles.marker}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={day ? `Day ${dayNumber}` : `Log day ${dayNumber}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <span className={styles.order}>{dayNumber}</span>
    </div>
  );
}
