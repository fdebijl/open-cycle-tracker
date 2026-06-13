import { Navigate } from 'react-router-dom';
import { isToday } from 'date-fns';
import { Spinner } from '@/components/Spinner';
import { useDays } from '@/data/hooks';

/** Resolves the "Tracking" nav item to today's day (or the cycle view if today
 * isn't tracked yet). */
export function Today() {
  const daysQuery = useDays();
  if (daysQuery.isLoading) return <Spinner label="Finding today…" />;
  const today = (daysQuery.data ?? []).find((d) => d.date && isToday(d.date));
  return <Navigate to={today ? `/days/${today.id}` : '/'} replace />;
}
