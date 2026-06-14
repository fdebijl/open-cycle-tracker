import { format } from 'date-fns';
import { Spinner } from '@/components/Spinner';
import { useCycles, useDays, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats, predictFertileWindow, predictNextPeriod } from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';
import styles from './Info.module.scss';

/** Read-only stats derived from the current cycle's decrypted days. (The Ember
 * page held user-entered averages; computing from tracked data is more useful.) */
export function Info() {
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const settingsQuery = useUserSettings();
  const periodDayIds = usePeriodDayIds();

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label="Loading stats…" />;
  }

  const allDays = daysQuery.data ?? [];
  const current = cyclesQuery.data?.[0];
  const days = allDays.filter((d) => d.cycleId === current?.id);
  const periodCount = days.filter((d) => periodDayIds.has(d.id)).length;

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays, periodDayIds)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength);
  const cycleStart = cycleOnset(days, periodDayIds);
  const { daysUntil: untilNext } = predictNextPeriod(cycleStart, stats);
  const fertile = predictFertileWindow(cycleStart, stats);

  // Observed range, shown only once the average is learned from real cycles.
  const range =
    stats.source === 'learned' && stats.observedLengths.length > 0
      ? `${Math.min(...stats.observedLengths)}–${Math.max(...stats.observedLengths)}`
      : null;
  const avgHint =
    stats.source === 'learned' ? `learned from ${stats.sampleSize} cycle${stats.sampleSize === 1 ? '' : 's'}` : 'from setup';

  return (
    <section className={styles.page}>
      <h1>My Info</h1>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{stats.averageLength}</span>
          <span className={styles.label}>Avg cycle length ({avgHint})</span>
        </div>
        {range && (
          <div className={styles.stat}>
            <span className={styles.value}>{range}</span>
            <span className={styles.label}>Observed range (days)</span>
          </div>
        )}
        <div className={styles.stat}>
          <span className={styles.value}>{periodCount}</span>
          <span className={styles.label}>Period days</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{untilNext ?? '-'}</span>
          <span className={styles.label}>Days until next period</span>
        </div>
      </div>

      {fertile.fertileStart && fertile.fertileEnd && (
        <p className={styles.forecast}>
          Estimated fertile window: {format(fertile.fertileStart, 'MMM d')} – {format(fertile.fertileEnd, 'MMM d')}
          {fertile.ovulation && <> (ovulation ~{format(fertile.ovulation, 'MMM d')})</>}
        </p>
      )}
    </section>
  );
}
