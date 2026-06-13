import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { useDays } from '@/data/hooks';

/** View a specific (past) cycle's circle. */
export function ShowCycle() {
  const { id } = useParams();
  const daysQuery = useDays();
  const navigate = useNavigate();

  if (daysQuery.isLoading) return <Spinner label="Loading cycle…" />;
  if (daysQuery.error) return <p className="oct-error">Could not load this cycle.</p>;

  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === id);
  if (days.length === 0) return <p>No days recorded for this cycle.</p>;

  return <CycleCircle days={days} onSelectDay={(day) => navigate(`/days/${day.id}`)} />;
}
