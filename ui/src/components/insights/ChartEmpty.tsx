import styles from './ChartEmpty.module.scss';

/** Placeholder shown in place of a chart when there isn't enough data yet. */
export function ChartEmpty({ message }: { message: string }) {
  return <p className={styles.empty}>{message}</p>;
}
