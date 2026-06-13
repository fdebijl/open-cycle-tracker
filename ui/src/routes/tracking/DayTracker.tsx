import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Spinner } from '@/components/Spinner';
import { CategoryRow } from '@/components/category/CategoryRow';
import {
  useCategories,
  useCategoryLevels,
  useCreateFactor,
  useDay,
  useDeleteFactor,
  useUpdateDay,
} from '@/data/hooks';
import { DAY_TYPES } from '@/data/types';
import type { CategoryLevel, DayType } from '@/data/types';
import styles from './DayTracker.module.scss';

const DAY_TYPE_LABELS: Record<DayType, string> = {
  none: 'None',
  period: 'Period',
  fertile: 'Fertile',
  ovulation: 'Ovulation',
  pms: 'PMS',
};

/** Edit a single day: set its phase (day type) and toggle the factors tracked
 * against each category level. Ports the Ember `tracking/day` route. */
export function DayTracker() {
  const { id } = useParams();
  const dayQuery = useDay(id);
  const categoriesQuery = useCategories();
  const levelsQuery = useCategoryLevels();

  const createFactor = useCreateFactor();
  const deleteFactor = useDeleteFactor(id ?? '');
  const updateDay = useUpdateDay();

  const levelsByCategory = useMemo(() => {
    const map = new Map<string, CategoryLevel[]>();
    for (const level of levelsQuery.data ?? []) {
      const list = map.get(level.categoryId) ?? [];
      list.push(level);
      map.set(level.categoryId, list);
    }
    return map;
  }, [levelsQuery.data]);

  if (dayQuery.isLoading || categoriesQuery.isLoading || levelsQuery.isLoading) {
    return <Spinner label="Loading day…" />;
  }
  if (dayQuery.error || !dayQuery.data) {
    return <p className="oct-error">Could not load this day.</p>;
  }

  const day = dayQuery.data;
  const selectedLevelIds = new Set(day.factors.map((f) => f.categoryLevelId));
  const factorByLevel = new Map(day.factors.map((f) => [f.categoryLevelId, f]));
  const mutating = createFactor.isPending || deleteFactor.isPending;

  function toggleLevel(levelId: string) {
    const existing = factorByLevel.get(levelId);
    if (existing) deleteFactor.mutate(existing.id);
    else if (id) createFactor.mutate({ dayId: id, categoryLevelId: levelId });
  }

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.date}>
          {day.date ? format(day.date, 'EEEE, d MMMM yyyy') : `Day ${day.order ?? ''}`}
        </h1>
        <div className={styles.dayTypes}>
          {DAY_TYPES.map((dt) => (
            <button
              key={dt}
              type="button"
              className={dt === day.dayType ? `${styles.dayType} ${styles.activeType}` : styles.dayType}
              aria-pressed={dt === day.dayType}
              disabled={updateDay.isPending}
              onClick={() => id && updateDay.mutate({ id, dayType: dt })}
            >
              {DAY_TYPE_LABELS[dt]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.categories}>
        {(categoriesQuery.data ?? []).map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            levels={levelsByCategory.get(category.id) ?? []}
            selectedLevelIds={selectedLevelIds}
            busy={mutating}
            onToggleLevel={toggleLevel}
          />
        ))}
      </div>
    </section>
  );
}
