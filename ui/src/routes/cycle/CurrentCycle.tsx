import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { CycleSetupForm } from '@/components/cycle/CycleSetupForm';
import type { CycleSetupValues } from '@/components/cycle/CycleSetupForm';
import { useCycles, useDays, useLogDay, useStartCycle, useUpdateSettings, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats, predictFertileWindow } from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';
import styles from './CurrentCycle.module.scss';

/**
 * The landing screen. Shows the current (newest) cycle as a circle anchored at
 * its period onset. A user with no cycle yet — refreshed mid-onboarding, or a
 * pre-existing account — gets the cycle-setup prompt instead (no recovery
 * phrase; that's one-time). "Start a new period" opens a fresh cycle.
 */
export function CurrentCycle() {
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const settingsQuery = useUserSettings();
  const startCycle = useStartCycle();
  const updateSettings = useUpdateSettings();
  const logDay = useLogDay();
  const navigate = useNavigate();
  const [setupError, setSetupError] = useState<string | null>(null);

  if (cyclesQuery.isLoading || daysQuery.isLoading || settingsQuery.isLoading) {
    return <Spinner label="Loading your cycle…" />;
  }
  if (cyclesQuery.error || daysQuery.error) {
    return <p className="oct-error">Could not load your cycle. Please try again.</p>;
  }

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const current = cyclesQuery.data?.[0];

  // No cycle yet: collect setup and bootstrap the first cycle.
  if (!current) {
    const onSetup = async ({ onset, averageCycleLength: length }: CycleSetupValues) => {
      setSetupError(null);
      try {
        await updateSettings.mutateAsync({ averageCycleLength: length });
        await startCycle.mutateAsync({ onset });
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : 'Could not set up your cycle. Please try again.');
      }
    };
    return (
      <section className={styles.setup}>
        <h1>Let’s set up your cycle</h1>
        <p className={styles.intro}>
          Tell us when your last period started and your typical cycle length. This anchors your first cycle and seeds
          your next-period estimate.
        </p>
        <CycleSetupForm
          onSubmit={onSetup}
          busy={updateSettings.isPending || startCycle.isPending}
          error={setupError}
          defaultAverageLength={averageCycleLength}
        />
      </section>
    );
  }

  const allDays = daysQuery.data ?? [];
  const days = allDays.filter((d) => d.cycleId === current.id);
  const cycleStart = cycleOnset(days);

  // Learn the average across every cycle's onset, then forecast off the current
  // onset. Falls back to the configured average until enough history exists.
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength);
  const fertile = predictFertileWindow(cycleStart, stats);

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
        includeFuture
        onSelectDay={(day) => navigate(`/days/${day.id}`)}
        onLogDate={onLogDate}
      />
      <button
        type="button"
        className="oct-primary"
        onClick={onStartNewPeriod}
        disabled={startCycle.isPending}
      >
        Start a new period
      </button>
    </div>
  );
}
