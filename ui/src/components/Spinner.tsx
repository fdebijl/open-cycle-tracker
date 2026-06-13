import styles from './Spinner.module.scss';

/** Lightweight loading spinner. (The Ember app's 20-dot gradient spinner can be
 * reinstated in a later pass; this keeps Phase 1 focused.) */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
