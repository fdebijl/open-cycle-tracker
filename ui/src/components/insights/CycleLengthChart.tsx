import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/i18n/format';
import type { CycleLengthPoint } from '@/data/insights';
import styles from './CycleLengthChart.module.scss';

// A fixed viewBox the SVG scales to fill its container width (mobile-first):
// the plot area leaves a small margin all round, with room for x-axis labels.
const VW = 100;
const VH = 60;
const PX0 = 8; // plot left
const PY0 = 4; // plot top
const PW = 90; // plot width
const PH = 44; // plot height (bottom edge at PY0 + PH = 48)

/**
 * Cycle-length history as vertical bars (one per completed cycle, oldest >
 * newest). When `showBand` is set, a rolling-average line and a ± variability
 * band are overlaid - that's the regularity trend. Hand-rolled SVG, matching the
 * `CycleCircle` / `Spinner` convention (no charting dependency).
 */
export function CycleLengthChart({ points, showBand }: { points: CycleLengthPoint[]; showBand: boolean }) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();

  const n = points.length;
  // y-scale spans the data (lengths and, when shown, the band) with 1 day of
  // padding each side so bars/line never touch the edges.
  const values = points.flatMap((p) => (showBand ? [p.length, p.bandLow, p.bandHigh] : [p.length]));
  const yMin = Math.min(...values) - 1;
  const yMax = Math.max(...values) + 1;
  const span = yMax - yMin || 1;
  const yScale = (v: number) => PY0 + PH * (1 - (v - yMin) / span);

  const slot = PW / n;
  const centerX = (i: number) => PX0 + i * slot + slot / 2;

  // Label every cycle when there are few; thin out when there are many.
  const labelEvery = Math.ceil(n / 6);

  // Band polygon: left>right along the high edge, then right>left along the low
  // edge, forming a filled ribbon around the rolling average.
  const bandPath =
    points.map((p, i) => `${centerX(i)},${yScale(p.bandHigh)}`).join(' ') +
    ' ' +
    [...points].reverse().map((p, i) => `${centerX(n - 1 - i)},${yScale(p.bandLow)}`).join(' ');

  const avgLine = points.map((p, i) => `${centerX(i)},${yScale(p.rollingAverage)}`).join(' ');

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t('insights.length.aria')}
    >
      {showBand && n > 1 && <polygon className={styles.band} points={bandPath} />}

      {points.map((p, i) => {
        const y = yScale(p.length);
        const barWidth = slot * 0.6;
        const x = PX0 + i * slot + (slot - barWidth) / 2;
        return (
          <rect
            key={`${p.cycleId ?? 'c'}-${i}`}
            className={p.plausible ? styles.bar : styles.barOutlier}
            x={x}
            y={y}
            width={barWidth}
            height={PY0 + PH - y}
            rx="1"
          >
            <title>{t('insights.length.barTitle', { count: p.length })}</title>
          </rect>
        );
      })}

      {showBand && n > 1 && <polyline className={styles.avgLine} points={avgLine} />}

      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={`label-${i}`} className={styles.axisLabel} x={centerX(i)} y={VH - 4} textAnchor="middle">
            {format(p.onset, 'MMM', { locale })}
          </text>
        ) : null,
      )}
    </svg>
  );
}
