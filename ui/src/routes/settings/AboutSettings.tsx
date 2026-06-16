import { useTranslation } from 'react-i18next';
import styles from './Settings.module.scss';

const SOURCE_URL = 'https://github.com/fdebijl/open-cycle-tracker';

export function AboutSettings() {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <h2>{t('settings.about.title')}</h2>
      <dl className={styles.account}>
        <dt>{t('settings.about.app')}</dt>
        <dd>Open Cycle Tracker</dd>
        <dt>{t('settings.about.version')}</dt>
        <dd>{__APP_VERSION__}</dd>
        <dt>{t('settings.about.license')}</dt>
        <dd>MIT</dd>
        <dt>{t('settings.about.source')}</dt>
        <dd>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer noopener">
            {t('settings.about.sourceLink')}
          </a>
        </dd>
      </dl>
    </div>
  );
}
