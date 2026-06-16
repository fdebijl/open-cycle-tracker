import styles from './Spinner.module.scss';

// Time for a full revolution, set lower than the scss value for a pause, higher (2x or 4x) for multiple active dots
const SPIN_SECONDS = 1.8;

const RED = 'var(--oct-red)';
const PURPLE = 'var(--oct-purple)';
const BLUE = 'var(--oct-blue)';
const YELLOW = 'var(--oct-yellow)';
const DOT_COLORS = [
  PURPLE, RED, RED, PURPLE, PURPLE, PURPLE, PURPLE, BLUE, BLUE, BLUE, BLUE,
  PURPLE, PURPLE, PURPLE, PURPLE, PURPLE, PURPLE, PURPLE, YELLOW, YELLOW, YELLOW,
];

export function Spinner({
  label,
  size = 'lg',
  dotCount = 20,
}: {
  label?: string;
  size?: 'sm' | 'lg';
  dotCount?: number;
}) {
  const dots = Array.from({ length: dotCount }, (_, i) => i + 1);
  return (
    <span
      className={size === 'sm' ? `${styles.wrap} ${styles.sm}` : `${styles.wrap} ${styles.lg}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className={styles.svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid"
        aria-hidden="true"
      >
        {dots.map((dot) => {
          const rotation = (360 / dotCount) * dot;
          // Legacy: begin = -(duration - (duration/dotCount) * dot)
          const delay = -(SPIN_SECONDS - (SPIN_SECONDS / dotCount) * dot);
          return (
            <g key={dot} transform={`rotate(${rotation} 50 50)`}>
              <rect
                className={styles.dot}
                x="45"
                y="4"
                rx="4"
                ry="4"
                width="8"
                height="8"
                fill={size === 'sm' ? 'white': DOT_COLORS[dot] ?? PURPLE}
                style={{ animationDelay: `${delay}s` }}
              />
            </g>
          );
        })}
      </svg>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
