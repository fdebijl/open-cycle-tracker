import { Spinner } from '@/components/Spinner';
import { useCycles, useDays, useUserSettings } from '@/data/hooks';
import { cycleOnset, nextPeriodEstimate } from '@/data/cycles';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';
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
  const settingsQuery = useUserSettings();

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label="Loading stats…" />;
  }

  const current = cyclesQuery.data?.[0];
  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === current?.id);
  const counts = countByType(days);

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const { daysUntil: untilNext } = nextPeriodEstimate(cycleOnset(days), averageCycleLength);

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
