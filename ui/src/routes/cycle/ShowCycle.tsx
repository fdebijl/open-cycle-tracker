import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { useDays, useLogDay, useUserSettings } from '@/data/hooks';
import { cycleOnset } from '@/data/cycles';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';

/** View a specific (past) cycle's circle. Doesn't extend to today, but empty
 * slots within the cycle's span are still tappable to backfill a missed day. */
export function ShowCycle() {
  const { id } = useParams();
  const daysQuery = useDays();
  const settingsQuery = useUserSettings();
  const logDay = useLogDay();
  const navigate = useNavigate();

  if (daysQuery.isLoading) return <Spinner label="Loading cycle…" />;
  if (daysQuery.error) return <p className="oct-error">Could not load this cycle.</p>;

  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === id);
  if (days.length === 0) return <p>No days recorded for this cycle.</p>;

  const onLogDate = async (date: Date) => {
    if (!id) return;
    const day = await logDay.mutateAsync({ date, cycleId: id });
    navigate(`/days/${day.id}`);
  };

  return (
    <CycleCircle
      days={days}
      cycleStart={cycleOnset(days)}
      averageCycleLength={settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH}
      onSelectDay={(day) => navigate(`/days/${day.id}`)}
      onLogDate={onLogDate}
    />
  );
}
