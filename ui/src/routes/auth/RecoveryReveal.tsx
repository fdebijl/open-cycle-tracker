import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import styles from './RecoveryReveal.module.scss';
import { Button } from '@/components/Button';

export function RecoveryReveal({ mnemonic, onConfirm }: { mnemonic: string; onConfirm: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const { t } = useTranslation();
  const words = mnemonic.trim().split(/\s+/);

  return (
    <div>
      <p className={styles.warning}>
        <Trans i18nKey="recovery.warning" />
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
        {t('recovery.acknowledge')}
      </label>
      <div className="oct-form-actions">
        <Button type="button" disabled={!acknowledged} onClick={onConfirm}>
          {t('recovery.continue')}
        </Button>
      </div>
    </div>
  );
}
