import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/i18n/format';
import { Spinner } from '@/components/Spinner';
import { BbtField } from '@/components/category/BbtField';
import { CategoryRow } from '@/components/category/CategoryRow';
import { useCategories, useCategoryLevels, useCreateFactor, useDay, useDeleteFactor } from '@/data/hooks';
import { BBT_SLUG, FLOW_SLUG } from '@/data/cycles';
import type { CategoryLevel } from '@/data/types';
import { DayNote } from './DayNote';
import styles from './DayTracker.module.scss';

/** Edit a single day: record flow (the period signal), a BBT reading, symptom
 * factors, and a free-text note. Fertile/ovulation are not tracked here - they're
 * a computed forecast shown in the cycle overview, not user-reported. */
export function DayTracker() {
  const { id } = useParams();
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const dayQuery = useDay(id);
  const categoriesQuery = useCategories();
  const levelsQuery = useCategoryLevels();

  const createFactor = useCreateFactor();
  const deleteFactor = useDeleteFactor(id ?? '');

  // Group levels under their category, ordered by their ordinal `order` so
  // scales like Flow read spotting → heavy.
  const levelsByCategory = useMemo(() => {
    const map = new Map<string, CategoryLevel[]>();
    for (const level of levelsQuery.data ?? []) {
      const list = map.get(level.categoryId) ?? [];
      list.push(level);
      map.set(level.categoryId, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [levelsQuery.data]);

  if (dayQuery.isLoading || categoriesQuery.isLoading || levelsQuery.isLoading) {
    return <Spinner label={t('tracking.loading')} />;
  }
  if (dayQuery.error || !dayQuery.data) {
    return <p className="oct-error">{t('tracking.loadError')}</p>;
  }

  const day = dayQuery.data;
  const selectedLevelIds = new Set(day.factors.map((f) => f.categoryLevelId));
  const factorByLevel = new Map(day.factors.map((f) => [f.categoryLevelId, f]));
  const mutating = createFactor.isPending || deleteFactor.isPending;

  // Toggle a discrete factor on/off (multi-select categories).
  function toggleLevel(levelId: string) {
    const existing = factorByLevel.get(levelId);
    if (existing) deleteFactor.mutate(existing.id);
    else if (id) createFactor.mutate({ dayId: id, categoryLevelId: levelId });
  }

  // Single-select for an ordinal category (Flow): picking a level replaces any
  // other selected level in the same category; picking the active one clears it.
  function selectSingle(levelId: string, categoryId: string) {
    const existing = factorByLevel.get(levelId);
    if (existing) {
      deleteFactor.mutate(existing.id);
      return;
    }
    for (const level of levelsByCategory.get(categoryId) ?? []) {
      const other = factorByLevel.get(level.id);
      if (other) deleteFactor.mutate(other.id);
    }
    if (id) createFactor.mutate({ dayId: id, categoryLevelId: levelId });
  }

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.date}>
          {day.date ? format(day.date, 'EEEE, d MMMM yyyy', { locale }) : t('tracking.dayFallback', { n: day.order ?? '' })}
        </h1>
      </header>

      <div className={styles.categories}>
        {(categoriesQuery.data ?? []).map((category) => {
          const levels = levelsByCategory.get(category.id) ?? [];
          // BBT is a numeric reading rather than discrete levels.
          if (category.slug === BBT_SLUG) {
            const level = levels[0];
            return (
              <BbtField
                key={category.id}
                dayId={id ?? ''}
                category={category}
                level={level}
                factor={level ? factorByLevel.get(level.id) : undefined}
              />
            );
          }
          // Flow is an ordinal scale - single-select.
          const single = category.slug === FLOW_SLUG;
          return (
            <CategoryRow
              key={category.id}
              category={category}
              levels={levels}
              selectedLevelIds={selectedLevelIds}
              busy={mutating}
              onToggleLevel={single ? (levelId) => selectSingle(levelId, category.id) : toggleLevel}
            />
          );
        })}
      </div>

      {id && <DayNote dayId={id} notes={day.notes} />}
    </section>
  );
}
