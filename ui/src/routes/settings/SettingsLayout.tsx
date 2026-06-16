import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './SettingsLayout.module.scss';

interface SettingsTab {
  // Relative path under /settings.
  to: string;
  // i18next key, resolved with t() in the body (TABS is module-level).
  labelKey: string;
}

const TABS: SettingsTab[] = [
  { to: 'profile', labelKey: 'settings.tabs.profile' },
  { to: 'health', labelKey: 'settings.tabs.health' },
  { to: 'personalization', labelKey: 'settings.tabs.personalization' },
  { to: 'security', labelKey: 'settings.tabs.security' },
  { to: 'about', labelKey: 'settings.tabs.about' },
];

export function SettingsLayout() {
  const { t } = useTranslation();
  return (
    <section className={styles.page}>
      <h1>{t('settings.title')}</h1>

      <nav className={styles.tabs} aria-label={t('settings.title')}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => [styles.tab, isActive ? styles.active : ''].join(' ')}
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </section>
  );
}
