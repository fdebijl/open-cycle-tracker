import { useTranslation } from 'react-i18next';
import { DEMO_MODE } from '@/config/env';
import styles from './DemoBanner.module.scss';

/** A persistent, non-dismissible warning shown on every page of a demo
 * deployment. Renders nothing outside demo mode. DEMO_MODE is resolved from
 * /config.js before render (see main.tsx), so this reads the final value. */
export function DemoBanner() {
  const { t } = useTranslation();

  if (!DEMO_MODE) return null;

  return (
    <div className={styles.banner} role="alert">
      {t('demo.warning')}
    </div>
  );
}
