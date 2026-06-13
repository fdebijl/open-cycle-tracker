import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/Spinner';
import { CycleCircle } from '@/components/cycle/CycleCircle';
import { useCreateCycleWithDays, useCycles, useDays } from '@/data/hooks';

/**
 * The landing screen. Loads the current cycle (the newest one) or, if the user
 * has none yet, creates one and populates 28 days — the React equivalent of the
 * Ember `cycle/current` route.
 */
export function CurrentCycle() {
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const createCycle = useCreateCycleWithDays();
  const navigate = useNavigate();

  // Guard against the StrictMode double-invoke (and concurrent pending) so we
  // never create two cycles.
  const creatingRef = useRef(false);
  useEffect(() => {
    if (cyclesQuery.data && cyclesQuery.data.length === 0 && !creatingRef.current) {
      creatingRef.current = true;
      createCycle.mutate(undefined, { onSettled: () => (creatingRef.current = false) });
    }
  }, [cyclesQuery.data, createCycle]);

  if (cyclesQuery.isLoading || daysQuery.isLoading || createCycle.isPending) {
    return <Spinner label="Loading your cycle…" />;
  }
  if (cyclesQuery.error || daysQuery.error) {
    return <p className="oct-error">Could not load your cycle. Please try again.</p>;
  }

  const current = cyclesQuery.data?.[0];
  if (!current) return <Spinner label="Setting up your first cycle…" />;

  const days = (daysQuery.data ?? []).filter((d) => d.cycleId === current.id);

  return <CycleCircle days={days} onSelectDay={(day) => navigate(`/days/${day.id}`)} />;
}
