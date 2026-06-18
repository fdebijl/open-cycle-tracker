import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { useUpdateSettings, useUserSettings } from '@/data/hooks';
import { DEFAULT_CYCLE_MARKERS } from '@/data/types';
import type { CycleMarkers } from '@/data/types';
import styles from './Settings.module.scss';

export function PersonalizationSettings() {
  const { t, i18n } = useTranslation();
  return (
    <>
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

      <CycleMarkersSection />
    </>
  );
}

/** The marker keys in display order. */
const MARKER_KEYS: (keyof CycleMarkers)[] = ['menstruation', 'fertile', 'ovulation', 'pms'];

function CycleMarkersSection() {
  const { t } = useTranslation();
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateSettings();

  // Reflect the stored settings; fall back to defaults while they load so the
  // toggles never flicker into an undefined state.
  const markers = settings?.markers ?? DEFAULT_CYCLE_MARKERS;

  const onToggle = (key: keyof CycleMarkers, value: boolean) => {
    updateSettings.mutate({ markers: { ...markers, [key]: value } });
  };

  return (
    <div className={styles.card}>
      <h2>{t('settings.markers.title')}</h2>
      <p className={styles.muted}>{t('settings.markers.intro')}</p>

      {MARKER_KEYS.map((key) => (
        <div key={key}>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={markers[key]}
              onChange={(e) => onToggle(key, e.target.checked)}
              disabled={!settings || updateSettings.isPending}
            />
            {t(`settings.markers.${key}`)}
          </label>
          {key === 'pms' && <p className={styles.muted}>{t('settings.markers.pmsHint')}</p>}
          {key === 'menstruation' && <p className={styles.muted}>{t('settings.markers.menstruationHint')}</p>}
        </div>
      ))}
    </div>
  );
}
