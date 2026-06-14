import { isToday } from 'date-fns';
import type { CSSProperties } from 'react';
import type { Day } from '@/data/types';
import styles from './DayMarker.module.scss';

/** A single slot dot positioned around the cycle circle. A logged `day` is
 * colored by its type; an unlogged slot renders empty (tappable to log that
 * date). An unlogged future slot may carry a `forecast` (predicted fertile /
 * ovulation), shown as a faint hint distinct from a logged day. An in-place ring
 * marks today. The day number fades in when the marker is scaled up by the
 * proximity scaler. */
export function DayMarker({
  day,
  isPeriod = false,
  date,
  dayNumber,
  forecast,
  style,
  onSelect,
}: {
  day?: Day;
  /** Whether this logged day carries a period-level Flow factor (color it as a
   * period day, taking precedence over its manual phase tag). */
  isPeriod?: boolean;
  date: Date;
  dayNumber: number;
  forecast?: 'fertile' | 'ovulation';
  style?: CSSProperties;
  onSelect?: () => void;
}) {
  const today = isToday(date);
  const dayType = day && isPeriod ? 'period' : 'none';
  return (
    <div
      data-day-marker
      data-daytype={dayType}
      data-forecast={!day && forecast ? forecast : undefined}
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
