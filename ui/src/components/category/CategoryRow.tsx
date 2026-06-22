import { useTranslation } from 'react-i18next';
import { MdiIcon } from '@/components/MdiIcon';
import type { Category, CategoryLevel } from '@/data/types';
import styles from './CategoryRow.module.scss';

export function CategoryRow({
  category,
  levels,
  selectedLevelIds,
  busy,
  onToggleLevel,
}: {
  category: Category;
  levels: CategoryLevel[];
  selectedLevelIds: Set<string>;
  busy: boolean;
  onToggleLevel: (levelId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.row}>
      <div className={styles.category}>
        <span className={styles.icon} style={category.color ? { background: category.color } : undefined}>
          <MdiIcon name={category.icon} size={0.9} color="#fff" />
        </span>
        <span className={styles.name}>{category.name}</span>
      </div>
      <ul className={styles.levels}>
        {levels.map((level) => {
          const selected = selectedLevelIds.has(level.id);
          return (
            <li key={level.id}>
              <button
                type="button"
                className={selected ? `${styles.level} ${styles.selected}` : styles.level}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => onToggleLevel(level.id)}
              >
                {level.name}
              </button>
            </li>
          );
        })}
        {levels.length === 0 && <li className={styles.empty}>{t('tracking.noLevels')}</li>}
      </ul>
    </div>
  );
}
