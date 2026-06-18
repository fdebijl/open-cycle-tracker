import { useTranslation } from 'react-i18next';
import type { CycleMarkers } from '@/data/types';
import styles from './CycleLegend.module.scss';

/** Marker keys in display order, paired with the swatch's `data-swatch` value so
 * the legend dot matches the color/style used on the circle. */
const ITEMS: { key: keyof CycleMarkers; swatch: string }[] = [
  { key: 'menstruation', swatch: 'period' },
  { key: 'fertile', swatch: 'fertile' },
  { key: 'ovulation', swatch: 'ovulation' },
  { key: 'pms', swatch: 'pms' },
];

/** A small legend below the cycle circle mapping each *enabled* marker to its
 * color/style (roadmap #25). Renders nothing when every marker is off. */
export function CycleLegend({ markers }: { markers: CycleMarkers }) {
  const { t } = useTranslation();
  const visible = ITEMS.filter((item) => markers[item.key]);
  if (visible.length === 0) return null;
  return (
    <ul className={styles.legend} aria-label={t('cycle.legend.title')}>
      {visible.map(({ key, swatch }) => (
        <li key={key} className={styles.item}>
          <span className={styles.swatch} data-swatch={swatch} aria-hidden="true" />
          {t(`settings.markers.${key}`)}
        </li>
      ))}
    </ul>
  );
}
