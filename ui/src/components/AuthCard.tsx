import type { ReactNode } from 'react';
import styles from './AuthCard.module.scss';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.brand}>Open Cycle Tracker</h1>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
