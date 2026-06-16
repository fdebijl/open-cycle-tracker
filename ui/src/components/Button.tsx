import styles from './Button.module.scss';

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false
} : {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles.button} ${styles[variant]}`}
      type={type}
    >
      {children}
    </button>
  );
}
