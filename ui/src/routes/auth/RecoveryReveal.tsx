import { useState } from 'react';
import styles from './RecoveryReveal.module.scss';

/**
 * Shows the one-time recovery mnemonic and forces the user to acknowledge they
 * have stored it. This phrase is the ONLY way to recover data after a forgotten
 * password — the server cannot help, by design.
 */
export function RecoveryReveal({ mnemonic, onConfirm }: { mnemonic: string; onConfirm: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const words = mnemonic.trim().split(/\s+/);

  return (
    <div>
      <p className={styles.warning}>
        Write these 24 words down and keep them somewhere safe and offline. They are the <strong>only</strong> way to
        recover your data if you forget your password. We cannot recover them for you.
      </p>
      <ol className={styles.words}>
        {words.map((word, i) => (
          <li key={i}>
            <span className={styles.index}>{i + 1}</span>
            {word}
          </li>
        ))}
      </ol>
      <label className={styles.ack}>
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        I have written down my recovery phrase.
      </label>
      <div className="oct-form-actions">
        <button type="button" className="oct-primary" disabled={!acknowledged} onClick={onConfirm}>
          Continue
        </button>
      </div>
    </div>
  );
}
