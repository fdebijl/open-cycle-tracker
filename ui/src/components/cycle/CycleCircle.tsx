import { useMemo, useRef } from 'react';
import { addDays, differenceInCalendarDays, isSameDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useResponsive } from '@/hooks/useResponsive';
import { cycleDayNumber } from '@/data/cycles';
import { forecastDayType, forecastMarkerEnabled, predictNextPeriod } from '@/data/prediction';
import type { CycleStats, FertilePrediction, ForecastType, PmsPrediction } from '@/data/prediction';
import type { CycleMarkers, Day } from '@/data/types';
import { DayMarker } from './DayMarker';
import { CycleLegend } from './CycleLegend';
import { useProximityScaler } from './useProximityScaler';
import styles from './CycleCircle.module.scss';

interface Slot {
  dayNumber: number;
  date: Date;
  day?: Day;
}

/** Human label for the countdown shown at the circle's center, derived from the
 * predicted next-period date. `margin` is the ± confidence band in days (from a
 * learned average's variability); 0 hides it. An empty `daysUntil` with an
 * `unknown`-confidence forecast becomes an explicit "unknown" rather than a
 * blank center (perimenopause/postmenopause). */
function countdownLabel(daysUntil: number | null, margin: number, unknown: boolean, t: TFunction): string {
  if (daysUntil === null) return unknown ? t('cycle.countdown.unknown') : '';
  const band = margin > 0 ? ` (±${margin})` : '';
  if (daysUntil < 0) return t('cycle.countdown.late', { count: Math.abs(daysUntil) });
  if (daysUntil === 0) return t('cycle.countdown.today');
  if (daysUntil === 1) return t('cycle.countdown.tomorrow');
  return t('cycle.countdown.daysUntil', { count: daysUntil, band });
}

/**
 * Renders a cycle as dots evenly spaced around a circle, day 1 (the onset) at
 * the top going clockwise. Slots run from the onset out to at least the average
 * cycle length (for the current cycle) or the last logged day (for a past one).
 * Logged days are filled and colored by type; empty slots are tappable to log
 * that date on demand. A next-period countdown sits in the center.
 */
export function CycleCircle({
  days,
  cycleStart,
  stats,
  fertile,
  pms,
  markers,
  periodDayIds,
  includeFuture = false,
  onSelectDay,
  onLogDate,
}: {
  days: Day[];
  cycleStart: Date | null;
  stats: CycleStats;
  fertile?: FertilePrediction;
  pms?: PmsPrediction;
  /** Which phase markers to show; gates both the forecast overlays and the
   * logged-period coloring. */
  markers: CycleMarkers;
  /** Day ids that carry a period-level Flow factor (drives period coloring). */
  periodDayIds: Set<string>;
  includeFuture?: boolean;
  onSelectDay: (day: Day) => void;
  onLogDate: (date: Date) => void;
}) {
  const { width, height } = useResponsive();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  useProximityScaler(containerRef);

  const slots = useMemo<Slot[]>(() => {
    if (!cycleStart) return [];
    const dated = days.filter((d) => d.date);
    const maxLogged = dated.reduce((max, d) => Math.max(max, cycleDayNumber(d.date as Date, cycleStart)), 1);
    const todayNumber = includeFuture ? cycleDayNumber(new Date(), cycleStart) : 0;
    const base = includeFuture ? Math.max(stats.averageLength, todayNumber) : 0;
    const slotCount = Math.max(1, maxLogged, base);

    return Array.from({ length: slotCount }, (_unused, i) => {
      const date = addDays(cycleStart, i);
      return { dayNumber: i + 1, date, day: dated.find((d) => isSameDay(d.date as Date, date)) };
    });
  }, [days, cycleStart, stats.averageLength, includeFuture]);

  const nextPeriod = predictNextPeriod(cycleStart, stats);
  const { daysUntil } = nextPeriod;
  // The band shown to the user is the actual predicted window (floored in
  // perimenopause, widened for highly variable cycles), not the raw variability.
  const margin =
    nextPeriod.date && nextPeriod.windowEnd ? differenceInCalendarDays(nextPeriod.windowEnd, nextPeriod.date) : 0;
  // A tracked cycle whose next onset can't be forecast (amenorrhea / too little
  // regular history / postmenopause) shows "unknown" instead of a blank center.
  const unknown = !!cycleStart && stats.confidence === 'unknown';

  const size = Math.max(220, Math.min(width || 360, height || 360) * 0.6);
  const center = size / 2;
  const radius = center * 0.82;
  const n = slots.length || 1;

  // The raw forecast for an empty future slot, kept only if the matching marker
  // is enabled (so the fertile/ovulation/PMS toggles act independently).
  const slotForecast = (slot: Slot): ForecastType | undefined => {
    if (slot.day || !includeFuture) return undefined;
    const raw = forecastDayType(slot.date, fertile, pms);
    return raw && forecastMarkerEnabled(raw, markers) ? raw : undefined;
  };

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.circle} style={{ width: size, height: size }}>
        {slots.map((slot, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <DayMarker
              key={slot.dayNumber}
              day={slot.day}
              isPeriod={markers.menstruation && slot.day ? periodDayIds.has(slot.day.id) : false}
              date={slot.date}
              dayNumber={slot.dayNumber}
              forecast={slotForecast(slot)}
              style={{ left: x, top: y }}
              onSelect={() => (slot.day ? onSelectDay(slot.day) : onLogDate(slot.date))}
            />
          );
        })}
        <p className={styles.countdown}>{countdownLabel(daysUntil, margin, unknown, t)}</p>
      </div>
      <CycleLegend markers={markers} />
    </div>
  );
}
