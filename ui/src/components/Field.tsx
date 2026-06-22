import type { InputHTMLAttributes } from 'react';
import styles from './Field.module.scss';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label?: string;
}

export function Field({ id, label, ...inputProps }: FieldProps) {
  return (
    <div className={styles.field}>
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} name={id} {...inputProps} />
    </div>
  );
}
