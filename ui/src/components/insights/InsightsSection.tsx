import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/Spinner';
import { useCategories, useInsights } from '@/data/hooks';
import { MIN_CYCLES_TO_LEARN } from '@/data/prediction';
import { ChartEmpty } from './ChartEmpty';
import { CycleLengthChart } from './CycleLengthChart';
import { SymptomPhaseChart } from './SymptomPhaseChart';
import type { SymptomRow } from './SymptomPhaseChart';
import styles from './InsightsSection.module.scss';

/**
 * The charts block on the Info screen (roadmap #11). Owns the data hooks,
 * decides each chart's empty / insufficient-data state, and hands the chart
 * components pre-computed, presentational data.
 */
export function InsightsSection() {
  const { t } = useTranslation();
  const { history, matrix, isLoading } = useInsights();
  const categoriesQuery = useCategories();

  if (isLoading) return <Spinner label={t('insights.loading')} size="sm" />;

  const { points, stats } = history;
  const learned = stats.source === 'learned';
  const margin = Math.round(stats.variability);

  // Join the matrix's category ids to their decrypted name + color for display.
  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
  const rows: SymptomRow[] = matrix.categories
    .map((row) => {
      const category = categoryById.get(row.categoryId);
      if (!category) return null;
      return { categoryId: row.categoryId, name: category.name, color: category.color, counts: row.counts, total: row.total };
    })
    .filter((r): r is SymptomRow => r !== null);

  return (
    <div className={styles.section}>
      {/* Cycle length + regularity trend */}
      <section className={styles.card}>
        <h2 className={styles.heading}>{t('insights.length.title')}</h2>
        {points.length === 0 ? (
          <ChartEmpty message={t('insights.length.empty')} />
        ) : (
          <>
            <CycleLengthChart points={points} showBand={learned} />
            {learned ? (
              <p className={styles.caption}>
                {margin > 0
                  ? t('insights.length.variabilityCaption', { count: margin })
                  : t('insights.length.steady')}
              </p>
            ) : (
              <p className={styles.caption}>
                {t('insights.length.keepTracking', {
                  count: Math.max(1, MIN_CYCLES_TO_LEARN - stats.observedLengths.length),
                })}
              </p>
            )}
          </>
        )}
      </section>

      {/* Symptom × phase heatmap */}
      <section className={styles.card}>
        <h2 className={styles.heading}>{t('insights.symptoms.title')}</h2>
        <p className={styles.subtitle}>{t('insights.symptoms.subtitle')}</p>
        {rows.length === 0 ? (
          <ChartEmpty message={t('insights.symptoms.empty')} />
        ) : (
          <SymptomPhaseChart rows={rows} phaseDayTotals={matrix.phaseDayTotals} />
        )}
      </section>
    </div>
  );
}
