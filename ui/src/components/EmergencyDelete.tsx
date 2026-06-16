import { useRef, useState } from 'react';
import styles from './EmergencyDelete.module.scss';

export function EmergencyDelete({
  label = 'Hold to delete',
  holdMs = 1800,
  onConfirm,
  disabled,
}: {
  label?: string;
  holdMs?: number;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  function stop() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    setProgress(0);
  }

  function tick(now: number) {
    if (startRef.current === null) startRef.current = now;
    const pct = Math.min(1, (now - startRef.current) / holdMs);
    setProgress(pct);
    if (pct >= 1) {
      stop();
      onConfirm();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function start() {
    if (disabled) return;
    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <button
      type="button"
      className={styles.button}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <span className={styles.fill} style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
