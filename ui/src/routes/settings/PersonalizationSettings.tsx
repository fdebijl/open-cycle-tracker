import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import styles from './Settings.module.scss';

export function PersonalizationSettings() {
  const { t, i18n } = useTranslation();
  return (
    <div className={styles.card}>
      <h2>{t('settings.language')}</h2>
      <select
        id="language"
        aria-label={t('settings.language')}
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.label}
          </option>
        ))}
      </select>
    </div>
  );
}
