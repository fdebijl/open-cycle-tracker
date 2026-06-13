import { NavLink } from 'react-router-dom';
import { MdiIcon } from './MdiIcon';
import styles from './NavBar.module.scss';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  size: number;
  priority?: boolean;
}

// Order and icons mirror the Ember nav-bar. "Cycle" is the priority item
// (larger, and floated to the top on desktop).
const ITEMS: NavItem[] = [
  { to: '/today', icon: 'pencil-outline', label: 'Tracking', size: 1.2 },
  { to: '/calendar', icon: 'calendar-month', label: 'Calendar', size: 1.2 },
  { to: '/', icon: 'reload', label: 'Cycle', size: 1.5, priority: true },
  { to: '/info', icon: 'account-outline', label: 'My Info', size: 1.2 },
  { to: '/settings', icon: 'cog-outline', label: 'Settings', size: 1.2 },
];

export function NavBar({ desktop }: { desktop: boolean }) {
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
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
