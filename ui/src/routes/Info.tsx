import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/i18n/format';
import { Spinner } from '@/components/Spinner';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { useCycles, useDays, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats, predictFertileWindow, predictNextPeriod } from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';
import styles from './Info.module.scss';

/** Read-only stats derived from the current cycle's decrypted days. (The Ember
 * page held user-entered averages; computing from tracked data is more useful.) */
export function Info() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const settingsQuery = useUserSettings();
  const periodDayIds = usePeriodDayIds();

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label={t('info.loading')} />;
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
    stats.source === 'learned'
      ? t('info.learnedFromCycles', { count: stats.sampleSize })
      : t('info.fromSetup');

  return (
    <section className={styles.page}>
      <h1>{t('info.title')}</h1>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{stats.averageLength}</span>
          <span className={styles.label}>{t('info.avgCycleLength', { hint: avgHint })}</span>
        </div>
        {range && (
          <div className={styles.stat}>
            <span className={styles.value}>{range}</span>
            <span className={styles.label}>{t('info.observedRange')}</span>
          </div>
        )}
        <div className={styles.stat}>
          <span className={styles.value}>{periodCount}</span>
          <span className={styles.label}>{t('info.periodDays')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{untilNext ?? '-'}</span>
          <span className={styles.label}>{t('info.daysUntilNext')}</span>
        </div>
      </div>

      {fertile.fertileStart && fertile.fertileEnd && (
        <p className={styles.forecast}>
          {t('info.fertileWindow', {
            start: format(fertile.fertileStart, 'MMM d', { locale }),
            end: format(fertile.fertileEnd, 'MMM d', { locale }),
          })}
          {fertile.ovulation && t('info.ovulation', { date: format(fertile.ovulation, 'MMM d', { locale }) })}
        </p>
      )}

      <InsightsSection />
    </section>
  );
}
