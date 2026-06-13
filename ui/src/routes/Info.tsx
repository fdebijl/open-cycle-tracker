import { differenceInCalendarDays } from 'date-fns';
import { Spinner } from '@/components/Spinner';
import { useCycles, useDays } from '@/data/hooks';
import type { Day, DayType } from '@/data/types';
import styles from './Info.module.scss';

const TYPE_LABELS: Record<DayType, string> = {
  none: 'Untyped',
  period: 'Period',
  fertile: 'Fertile',
  ovulation: 'Ovulation',
  pms: 'PMS',
};

function countByType(days: Day[]): Record<DayType, number> {
  const counts: Record<DayType, number> = { none: 0, period: 0, fertile: 0, ovulation: 0, pms: 0 };
  for (const d of days) counts[d.dayType] += 1;
  return counts;
}

/** Read-only stats derived from the current cycle's decrypted days. (The Ember
 * page held user-entered averages; computing from tracked data is more useful.) */
export function Info() {
  const cyclesQuery = useCycles();
  const daysQuery = useDays();

  if (cyclesQuery.isLoading || daysQuery.isLoading) return <Spinner label="Loading stats…" />;

  const current = cyclesQuery.data?.[0];
  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === current?.id);
  const counts = countByType(days);

  const dated = days.filter((d) => d.date).sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  const last = dated[dated.length - 1]?.date ?? null;
  const untilNext = last ? differenceInCalendarDays(last, new Date()) : null;

  return (
    <section className={styles.page}>
      <h1>My Info</h1>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{days.length}</span>
          <span className={styles.label}>Days in cycle</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{counts.period}</span>
          <span className={styles.label}>Period days</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{untilNext ?? '—'}</span>
          <span className={styles.label}>Days until next period</span>
        </div>
      </div>

      <h2 className={styles.subhead}>Phase breakdown</h2>
      <ul className={styles.breakdown}>
        {(Object.keys(TYPE_LABELS) as DayType[]).map((t) => (
          <li key={t}>
            <span>{TYPE_LABELS[t]}</span>
            <span className={styles.count} data-daytype={t}>
              {counts[t]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
