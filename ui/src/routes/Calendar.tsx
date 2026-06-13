import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Spinner } from '@/components/Spinner';
import { useDays } from '@/data/hooks';
import styles from './Calendar.module.scss';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Month grid of tracked days, colored by day type; clicking a tracked day opens
 * its editor. Replaces the Ember ember-power-calendar view. */
export function Calendar() {
  const daysQuery = useDays();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  if (daysQuery.isLoading) return <Spinner label="Loading calendar…" />;

  // Index tracked days by calendar date for O(1) cell lookup.
  const byDate = new Map(
    (daysQuery.data ?? []).filter((d) => d.date).map((d) => [format(d.date as Date, 'yyyy-MM-dd'), d]),
  );

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const cells = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <button type="button" className={styles.nav} onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
          ‹
        </button>
        <h1 className={styles.title}>{format(month, 'MMMM yyyy')}</h1>
        <button type="button" className={styles.nav} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
          ›
        </button>
      </header>

      <div className={styles.grid}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const day = byDate.get(key);
          const classes = [
            styles.cell,
            isSameMonth(date, month) ? '' : styles.outside,
            isToday(date) ? styles.today : '',
            day ? styles.tracked : '',
          ].join(' ');
          return (
            <button
              key={key}
              type="button"
              className={classes}
              data-daytype={day?.dayType}
              disabled={!day}
              onClick={() => day && navigate(`/days/${day.id}`)}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </section>
  );
}
