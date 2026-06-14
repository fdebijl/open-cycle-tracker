import { useState } from 'react';
import { MdiIcon } from '@/components/MdiIcon';
import { useCreateFactor, useDeleteFactor, useUpdateFactor } from '@/data/hooks';
import type { Category, CategoryLevel, Factor } from '@/data/types';
import styles from './CategoryRow.module.scss';

/**
 * A numeric reading (basal body temperature) for a day. Unlike a normal category
 * - which toggles discrete level factors - BBT is a single number, stored as the
 * encrypted `value` on one factor against the category's single level. Commits on
 * blur (or Enter); clearing the field deletes the reading.
 */
export function BbtField({
  dayId,
  category,
  level,
  factor,
}: {
  dayId: string;
  category: Category;
  level: CategoryLevel | undefined;
  factor: Factor | undefined;
}) {
  const create = useCreateFactor();
  const update = useUpdateFactor(dayId);
  const remove = useDeleteFactor(dayId);
  const value = factor?.value ?? null;
  const [text, setText] = useState(value != null ? String(value) : '');

  // Resync the input when the stored reading changes (e.g. after a refetch) by
  // tracking the previous value and adjusting during render - no effect needed.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value != null ? String(value) : '');
  }

  const busy = create.isPending || update.isPending || remove.isPending;

  function commit() {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (factor) remove.mutate(factor.id);
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return;
    if (factor) update.mutate({ id: factor.id, value });
    else if (level) create.mutate({ dayId, categoryLevelId: level.id, value });
  }

  return (
    <div className={styles.row}>
      <div className={styles.category}>
        <span className={styles.icon} style={category.color ? { background: category.color } : undefined}>
          <MdiIcon name={category.icon} size={0.9} color="#fff" />
        </span>
        <span className={styles.name}>{category.name}</span>
      </div>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        className={styles.numeric}
        placeholder="°C"
        aria-label={`${category.name} reading`}
        value={text}
        disabled={busy || !level}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
