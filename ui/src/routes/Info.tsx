import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/i18n/format';
import { Spinner } from '@/components/Spinner';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { useCurrentCycleSymptoDays, useCycles, useDays, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import {
  cycleStats,
  predictFertileWindow,
  predictNextPeriod,
  refineFertileWindow,
  SKIPPED_CYCLE_MIN_GAP,
} from '@/data/prediction';
import { symptothermal } from '@/data/symptothermal';
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

  // Derived before the early return so the symptothermal hook is always called in
  // the same order (rules of hooks).
  const current = cyclesQuery.data?.[0];
  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === current?.id);
  const symptoDays = useCurrentCycleSymptoDays(current?.id, days);

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label={t('info.loading')} />;
  }

  const allDays = daysQuery.data ?? [];
  const periodCount = days.filter((d) => periodDayIds.has(d.id)).length;

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const mode = settingsQuery.data?.trackingMode ?? 'standard';
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays, periodDayIds)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength, { mode, asOf: new Date() });
  const cycleStart = cycleOnset(days, periodDayIds);
  const { daysUntil: untilNext } = predictNextPeriod(cycleStart, stats);
  const fertile = refineFertileWindow(predictFertileWindow(cycleStart, stats), symptothermal(symptoDays));

  // Observed range, shown only once the average is learned from real cycles.
  const range =
    stats.source === 'learned' && stats.observedLengths.length > 0
      ? `${Math.min(...stats.observedLengths)}–${Math.max(...stats.observedLengths)}`
      : null;
  const avgHint =
    stats.source === 'learned'
      ? t('info.learnedFromCycles', { count: stats.sampleSize })
      : t('info.fromSetup');

  const averageStat = (
    <div className={styles.stat}>
      <span className={styles.value}>{stats.averageLength}</span>
      <span className={styles.label}>{t('info.avgCycleLength', { hint: avgHint })}</span>
    </div>
  );
  const rangeStat = range && (
    <div className={styles.stat}>
      <span className={styles.value}>{range}</span>
      <span className={styles.label}>{t('info.observedRange')}</span>
    </div>
  );
  // The next-period forecast is null in perimenopause/postmenopause when it can't
  // be trusted; say so explicitly rather than showing a bare dash.
  const nextUnknown = stats.confidence === 'unknown';

  return (
    <section className={styles.page}>
      <h1>{t('info.title')}</h1>
      <div className={styles.stats}>
        {/* In irregular (peri/postmeno) modes the observed range is the more
            honest headline than a single learned average, so it leads. */}
        {mode === 'standard' ? (
          <>
            {averageStat}
            {rangeStat}
          </>
        ) : (
          <>
            {rangeStat}
            {averageStat}
          </>
        )}
        <div className={styles.stat}>
          <span className={styles.value}>{periodCount}</span>
          <span className={styles.label}>{t('info.periodDays')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{nextUnknown ? '?' : (untilNext ?? '-')}</span>
          <span className={styles.label}>{t('info.daysUntilNext')}</span>
        </div>
      </div>

      {nextUnknown && <p className={styles.forecast}>{t('info.nextUnknown')}</p>}
      {stats.longestRecentGap != null && stats.longestRecentGap >= SKIPPED_CYCLE_MIN_GAP && (
        <p className={styles.forecast}>{t('info.longGap', { days: stats.longestRecentGap })}</p>
      )}
      {stats.isHighlyVariable && <p className={styles.note}>{t('info.highlyVariable')}</p>}

      {fertile.confirmed && fertile.confirmedOvulation ? (
        <>
          <p className={styles.forecast}>
            {t('info.ovulationConfirmed', { date: format(fertile.confirmedOvulation, 'MMM d', { locale }) })}
          </p>
          <p className={styles.disclaimer}>{t('info.notContraceptive')}</p>
        </>
      ) : (
        fertile.fertileStart &&
        fertile.fertileEnd && (
          <p className={styles.forecast}>
            {t('info.fertileWindow', {
              start: format(fertile.fertileStart, 'MMM d', { locale }),
              end: format(fertile.fertileEnd, 'MMM d', { locale }),
            })}
            {fertile.ovulation && t('info.ovulation', { date: format(fertile.ovulation, 'MMM d', { locale }) })}
          </p>
        )
      )}

      <InsightsSection />
    </section>
  );
}
