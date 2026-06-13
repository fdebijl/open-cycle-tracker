import { isToday } from 'date-fns';
import type { CSSProperties } from 'react';
import type { Day } from '@/data/types';
import styles from './DayMarker.module.scss';

/** A single day dot positioned around the cycle circle. Color encodes the day
 * type; an in-place ring marks today. The order number fades in when the marker
 * is scaled up by the proximity scaler. */
export function DayMarker({ day, style, onSelect }: { day: Day; style?: CSSProperties; onSelect?: () => void }) {
  const today = day.date ? isToday(day.date) : false;
  return (
    <div
      data-day-marker
      data-daytype={day.dayType}
      data-today={today ? '1' : undefined}
      data-scaled="0"
      className={styles.marker}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Day ${day.order}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <span className={styles.order}>{day.order}</span>
    </div>
  );
}
