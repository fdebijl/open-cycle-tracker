import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdiIcon } from './MdiIcon';
import styles from './NavBar.module.scss';

interface NavItem {
  to: string;
  icon: string;
  // i18next key for the label, resolved with t() inside the component (ITEMS is
  // module-level, where the t() hook isn't available).
  labelKey: string;
  size: number;
  priority?: boolean;
}

// Order and icons mirror the Ember nav-bar. "Cycle" is the priority item
// (larger, and floated to the top on desktop).
const ITEMS: NavItem[] = [
  { to: '/today', icon: 'pencil-outline', labelKey: 'nav.tracking', size: 1.2 },
  { to: '/calendar', icon: 'calendar-month', labelKey: 'nav.calendar', size: 1.2 },
  { to: '/', icon: 'reload', labelKey: 'nav.cycle', size: 1.5, priority: true },
  { to: '/info', icon: 'account-outline', labelKey: 'nav.info', size: 1.2 },
  { to: '/settings', icon: 'cog-outline', labelKey: 'nav.settings', size: 1.2 },
];

export function NavBar({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation();
  return (
    <nav className={desktop ? `${styles.nav} ${styles.desktop}` : styles.nav}>
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [styles.item, item.priority ? styles.priority : '', isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.iconWrap}>
            <MdiIcon name={item.icon} size={item.size} />
          </span>
          <span className={styles.label}>{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
