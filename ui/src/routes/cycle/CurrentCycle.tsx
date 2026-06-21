import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { CycleSetupForm } from '@/components/cycle/CycleSetupForm';
import type { CycleSetupValues } from '@/components/cycle/CycleSetupForm';
import {
  useCurrentCycleSymptoDays,
  useCycles,
  useDays,
  useLogDay,
  usePeriodDayIds,
  useStartCycle,
  useUpdateSettings,
  useUserSettings,
} from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats, predictFertileWindow, predictPmsWindow, refineFertileWindow } from '@/data/prediction';
import { symptothermal } from '@/data/symptothermal';
import { DEFAULT_AVERAGE_CYCLE_LENGTH, DEFAULT_CYCLE_MARKERS } from '@/data/types';
import styles from './CurrentCycle.module.scss';
import { Button } from '@/components/Button';

/**
 * The landing screen. Shows the current (newest) cycle as a circle anchored at
 * its period onset. A user with no cycle yet - refreshed mid-onboarding, or a
 * pre-existing account - gets the cycle-setup prompt instead (no recovery
 * phrase; that's one-time). "Start a new period" opens a fresh cycle.
 */
export function CurrentCycle() {
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const settingsQuery = useUserSettings();
  const periodDayIds = usePeriodDayIds();
  const startCycle = useStartCycle();
  const updateSettings = useUpdateSettings();
  const logDay = useLogDay();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [setupError, setSetupError] = useState<string | null>(null);

  // Derived before the early returns so the symptothermal hook (which runs its
  // own queries) is always called in the same order, per the rules of hooks.
  const current = cyclesQuery.data?.[0];
  const allDays = daysQuery.data ?? [];
  const days = allDays.filter((d) => d.cycleId === current?.id);
  const symptoDays = useCurrentCycleSymptoDays(current?.id, days);

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label={t('cycle.loading')} />;
  }
  if (cyclesQuery.error || daysQuery.error) {
    return <p className="oct-error">{t('cycle.loadError')}</p>;
  }

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;

  // No cycle yet: collect setup and bootstrap the first cycle.
  if (!current) {
    const onSetup = async ({ onset, averageCycleLength: length }: CycleSetupValues) => {
      setSetupError(null);
      try {
        await updateSettings.mutateAsync({ averageCycleLength: length });
        await startCycle.mutateAsync({ onset });
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : t('cycle.setupFailed'));
      }
    };
    return (
      <section className={styles.setup}>
        <h1>{t('cycle.setupTitle')}</h1>
        <p className={styles.intro}>{t('cycle.setupIntro')}</p>
        <CycleSetupForm
          onSubmit={onSetup}
          busy={updateSettings.isPending || startCycle.isPending}
          error={setupError}
          defaultAverageLength={averageCycleLength}
        />
      </section>
    );
  }

  const cycleStart = cycleOnset(days, periodDayIds);

  // Learn the average across every cycle's onset, then forecast off the current
  // onset. Falls back to the configured average until enough history exists.
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays, periodDayIds)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength, {
    mode: settingsQuery.data?.trackingMode,
    asOf: new Date(),
  });

  // Compute overlays only for enabled markers, so a disabled one never reaches a
  // slot. Fertile and ovulation share one prediction, so it's computed when
  // either is on; PMS is gated separately (and self-gates on reliability).
  const markers = settingsQuery.data?.markers ?? DEFAULT_CYCLE_MARKERS;
  // Forward calendar forecast, then sharpened with symptothermal confirmation for
  // the current cycle once enough BBT + mucus has been logged (no-op otherwise).
  const fertile =
    markers.fertile || markers.ovulation
      ? refineFertileWindow(predictFertileWindow(cycleStart, stats), symptothermal(symptoDays))
      : undefined;
  const pms = markers.pms ? predictPmsWindow(cycleStart, stats) : undefined;

  const onLogDate = async (date: Date) => {
    const day = await logDay.mutateAsync({ date, cycleId: current.id });
    navigate(`/days/${day.id}`);
  };

  const onStartNewPeriod = async () => {
    const { day } = await startCycle.mutateAsync({ onset: new Date() });
    navigate(`/days/${day.id}`);
  };

  return (
    <div className={styles.page}>
      <CycleCircle
        days={days}
        cycleStart={cycleStart}
        stats={stats}
        fertile={fertile}
        pms={pms}
        markers={markers}
        periodDayIds={periodDayIds}
        includeFuture
        onSelectDay={(day) => navigate(`/days/${day.id}`)}
        onLogDate={onLogDate}
      />
      <Button
        type="button"
        onClick={onStartNewPeriod}
        disabled={startCycle.isPending}
      >
        {t('cycle.startNewPeriod')}
      </Button>
    </div>
  );
}
