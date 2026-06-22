import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateDay } from '@/data/hooks';
import styles from './DayTracker.module.scss';

/**
 * Free-text journal note for a day. Lives on the Day itself (not a Factor), so a
 * day with no symptom still has somewhere to write. Commits on blur, only when
 * the text actually changed; an empty note clears it.
 */
export function DayNote({ dayId, notes }: { dayId: string; notes: string | null }) {
  const { t } = useTranslation();
  const updateDay = useUpdateDay();
  const [text, setText] = useState(notes ?? '');
  const [lastNotes, setLastNotes] = useState(notes);
  if (notes !== lastNotes) {
    setLastNotes(notes);
    setText(notes ?? '');
  }

  function commit() {
    const next = text.trim() || null;
    if (next !== (notes ?? null)) updateDay.mutate({ id: dayId, notes: next });
  }

  return (
    <label className={styles.noteField}>
      <span className={styles.noteLabel}>{t('tracking.notes')}</span>
      <textarea
        className={styles.note}
        rows={3}
        placeholder={t('tracking.notePlaceholder')}
        value={text}
        disabled={updateDay.isPending}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    </label>
  );
}
