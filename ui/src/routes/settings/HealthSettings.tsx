import { useTranslation } from 'react-i18next';
import styles from './Settings.module.scss';

export function HealthSettings() {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <h2>{t('settings.health.title')}</h2>
      <p className={styles.muted}>{t('settings.health.empty')}</p>
    </div>
  );
}
