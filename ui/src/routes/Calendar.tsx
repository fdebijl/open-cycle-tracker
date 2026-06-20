import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/i18n/format';
import { Spinner } from '@/components/Spinner';
import { useCycles, useDays, useLogDay, usePeriodDayIds, useUserSettings } from '@/data/hooks';
import { cycleForDate, cycleOnsets } from '@/data/cycles';
import {
  cycleStats,
  forecastDayType,
  forecastMarkerEnabled,
  predictFertileWindow,
  predictNextPeriod,
  predictPmsWindow,
} from '@/data/prediction';
import { DEFAULT_AVERAGE_CYCLE_LENGTH, DEFAULT_CYCLE_MARKERS } from '@/data/types';
import styles from './Calendar.module.scss';

/** Month grid of tracked days, colored by day type; clicking a tracked day opens
 * its editor. Replaces the Ember ember-power-calendar view. */
export function Calendar() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  // Mon-first weekday headers; kept as a translated array so a future locale can
  // reorder/relabel without touching the grid.
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];
  const daysQuery = useDays();
  const cyclesQuery = useCycles();
  const settingsQuery = useUserSettings();
  const periodDayIds = usePeriodDayIds();
  const logDay = useLogDay();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  if (daysQuery.isLoading || cyclesQuery.isLoading) return <Spinner label={t('calendar.loading')} />;

  const allDays = daysQuery.data ?? [];
  const cycles = cyclesQuery.data ?? [];
  const currentCycleId = cycles[0]?.id;

  // Index tracked days by calendar date for O(1) cell lookup.
  const byDate = new Map(allDays.filter((d) => d.date).map((d) => [format(d.date as Date, 'yyyy-MM-dd'), d]));

  // Onset per cycle (derived from its days), so a newly logged date lands in the
  // cycle whose span contains it rather than always the current one.
  const cyclesWithOnsets = cycleOnsets(cycles, allDays, periodDayIds);

  // Forecast (non-persisted overlay) off the current cycle's onset.
  const averageCycleLength = settingsQuery.data?.averageCycleLength ?? DEFAULT_AVERAGE_CYCLE_LENGTH;
  const stats = cycleStats(
    cyclesWithOnsets.map((c) => c.onset).filter((o): o is Date => o != null),
    averageCycleLength,
    { mode: settingsQuery.data?.trackingMode, asOf: new Date() },
  );
  const currentOnset = cyclesWithOnsets.find((c) => c.id === currentCycleId)?.onset ?? null;

  // Overlays are gated on the user's marker preferences (same as the circle), so
  // a marker turned off doesn't reappear on the calendar. Fertile/ovulation
  // share one prediction; PMS self-gates on reliability.
  const markers = settingsQuery.data?.markers ?? DEFAULT_CYCLE_MARKERS;
  const fertile =
    markers.fertile || markers.ovulation ? predictFertileWindow(currentOnset, stats) : undefined;
  const pms = markers.pms ? predictPmsWindow(currentOnset, stats) : undefined;
  const nextPeriod = predictNextPeriod(currentOnset, stats);

  // Predicted label for an empty future cell: period window takes precedence,
  // then ovulation/fertile/PMS. Each is gated by its marker toggle. `null` for
  // past/today/logged cells.
  const today = new Date();
  const forecastFor = (date: Date): 'period' | 'fertile' | 'ovulation' | 'pms' | null => {
    if (!isAfter(date, today)) return null;
    if (
      markers.menstruation &&
      nextPeriod.windowStart &&
      nextPeriod.windowEnd &&
      isWithinInterval(date, { start: nextPeriod.windowStart, end: nextPeriod.windowEnd })
    ) {
      return 'period';
    }
    const raw = forecastDayType(date, fertile, pms);
    return raw && forecastMarkerEnabled(raw, markers) ? raw : null;
  };

  const onPick = async (date: Date) => {
    const existing = byDate.get(format(date, 'yyyy-MM-dd'));
    if (existing) {
      navigate(`/days/${existing.id}`);
      return;
    }
    // No cycle yet → send the user to set one up first.
    if (!currentCycleId) {
      navigate('/');
      return;
    }
    const day = await logDay.mutateAsync({ date, cycleId: cycleForDate(date, cyclesWithOnsets, currentCycleId) });
    navigate(`/days/${day.id}`);
  };

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const cells = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <button type="button" className={styles.nav} onClick={() => setMonth(subMonths(month, 1))} aria-label={t('calendar.prevMonth')}>
          ‹
        </button>
        <h1 className={styles.title}>{format(month, 'MMMM yyyy', { locale })}</h1>
        <button type="button" className={styles.nav} onClick={() => setMonth(addMonths(month, 1))} aria-label={t('calendar.nextMonth')}>
          ›
        </button>
      </header>

      <div className={styles.grid}>
        {weekdays.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const day = byDate.get(key);
          const forecast = day ? null : forecastFor(date);
          // A logged day is colored as a period day when it carries a Flow factor
          // and the menstruation marker is enabled, otherwise neutral ('none');
          // empty cells get no day-type tint.
          const dayType = day ? (markers.menstruation && periodDayIds.has(day.id) ? 'period' : 'none') : undefined;
          const classes = [
            styles.cell,
            isSameMonth(date, month) ? '' : styles.outside,
            isToday(date) ? styles.today : '',
            day ? styles.tracked : '',
            forecast ? styles.forecast : '',
          ].join(' ');
          return (
            <button
              key={key}
              type="button"
              className={classes}
              data-daytype={dayType}
              data-forecast={forecast ?? undefined}
              disabled={logDay.isPending}
              onClick={() => onPick(date)}
            >
              {format(date, 'd', { locale })}
            </button>
          );
        })}
      </div>
    </section>
  );
}
