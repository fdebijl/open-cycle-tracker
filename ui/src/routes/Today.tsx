import { Navigate } from 'react-router-dom';
import { isToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/Spinner';
import { useDays } from '@/data/hooks';

/** Resolves the "Tracking" nav item to today's day (or the cycle view if today
 * isn't tracked yet). */
export function Today() {
  const { t } = useTranslation();
  const daysQuery = useDays();

  if (daysQuery.isLoading) {
    return <Spinner label={t('tracking.findingToday')} />;
  }

  const today = (daysQuery.data ?? []).find((d) => d.date && isToday(d.date));
  return <Navigate to={today ? `/days/${today.id}` : '/'} replace />;
}
