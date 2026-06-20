import { useTranslation } from 'react-i18next';
import { PHASES } from '@/data/insights';
import type { CyclePhase, PhaseCounts } from '@/data/insights';
import styles from './SymptomPhaseChart.module.scss';

/** One heatmap row: a category with its name, color and per-phase counts. */
export interface SymptomRow {
  categoryId: string;
  name: string;
  color: string;
  counts: PhaseCounts;
  total: number;
}

/**
 * Symptom-vs-cycle-phase correlation as a heatmap table (categories × phases).
 * Each cell is shaded by how often the symptom was logged during that phase,
 * relative to the number of days tracked in the phase. A real `<table>` (rather
 * than SVG) gives free screen-reader semantics for tabular data.
 */
export function SymptomPhaseChart({ rows, phaseDayTotals }: { rows: SymptomRow[]; phaseDayTotals: PhaseCounts }) {
  const { t } = useTranslation();

  // Frequency 0..1 of a count against the days tracked in that phase, used as the
  // cell's color opacity (with a floor so a single log is still faintly visible).
  const frequency = (count: number, phase: CyclePhase): number => {
    const days = phaseDayTotals[phase];
    if (count === 0 || days === 0) return 0;
    return Math.min(1, count / days);
  };

  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>{t('insights.symptoms.title')}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.corner}>
            {t('insights.symptoms.symptom')}
          </th>
          {PHASES.map((phase) => (
            <th key={phase} scope="col" className={styles.phaseHead}>
              {t(`insights.phases.${phase}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.categoryId}>
            <th scope="row" className={styles.rowHead}>
              {row.name}
            </th>
            {PHASES.map((phase) => {
              const count = row.counts[phase];
              const freq = frequency(count, phase);
              return (
                <td
                  key={phase}
                  className={styles.cell}
                  aria-label={t('insights.symptoms.cellAria', {
                    count,
                    symptom: row.name,
                    phase: t(`insights.phases.${phase}`),
                  })}
                >
                  <span
                    className={styles.fill}
                    style={{ background: row.color, opacity: freq === 0 ? 0 : 0.15 + 0.85 * freq }}
                    aria-hidden="true"
                  />
                  <span className={styles.count}>{count > 0 ? count : ''}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
