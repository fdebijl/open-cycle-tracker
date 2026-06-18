import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { useCycles, useDays, useLogDay, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleOnset, cycleOnsets } from '@/data/cycles';
import { cycleStats } from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH, DEFAULT_CYCLE_MARKERS } from '@/data/types';

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
  const { t } = useTranslation();

  if (daysQuery.isLoading) return <Spinner label={t('cycle.showLoading')} />;
  if (daysQuery.error) return <p className="oct-error">{t('cycle.showLoadError')}</p>;

  const allDays = daysQuery.data ?? [];
  const days = allDays.filter((d) => d.cycleId === id);
  if (days.length === 0) return <p>{t('cycle.noDays')}</p>;

  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const onsets = cycleOnsets(cyclesQuery.data ?? [], allDays, periodDayIds)
    .map((c) => c.onset)
    .filter((o): o is Date => o != null);
  const stats = cycleStats(onsets, averageCycleLength);
  const markers = settingsQuery.data?.markers ?? DEFAULT_CYCLE_MARKERS;

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
      markers={markers}
      periodDayIds={periodDayIds}
      onSelectDay={(day) => navigate(`/days/${day.id}`)}
      onLogDate={onLogDate}
    />
  );
}
