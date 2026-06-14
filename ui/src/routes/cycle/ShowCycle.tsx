import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { useCycles, useDays, useLogDay, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats } from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';

/** View a specific (past) cycle's circle. Doesn't extend to today, but empty
 * slots within the cycle's span are still tappable to backfill a missed day. */
export function ShowCycle() {
  const { id } = useParams();
  const daysQuery = useDays();
  const cyclesQuery = useCycles();
  const settingsQuery = useUserSettings();
  const periodDayIds = usePeriodDayIds();
  const logDay = useLogDay();
  const navigate = useNavigate();

  if (daysQuery.isLoading) return <Spinner label="Loading cycle…" />;
  if (daysQuery.error) return <p className="oct-error">Could not load this cycle.</p>;

  const allDays = daysQuery.data ?? [];
  const days = allDays.filter((d) => d.cycleId === id);
  if (days.length === 0) return <p>No days recorded for this cycle.</p>;

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays, periodDayIds)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength);

  const onLogDate = async (date: Date) => {
    if (!id) return;
    const day = await logDay.mutateAsync({ date, cycleId: id });
    navigate(`/days/${day.id}`);
  };

  return (
    <CycleCircle
      days={days}
      cycleStart={cycleOnset(days, periodDayIds)}
      stats={stats}
      periodDayIds={periodDayIds}
      onSelectDay={(day) => navigate(`/days/${day.id}`)}
      onLogDate={onLogDate}
    />
  );
}
