import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logoutAccount } from '@/auth/session';
import { useVault } from '@/stores/vault';
import { useDisplayName } from '@/data/hooks';
import { useResponsive } from '@/hooks/useResponsive';
import { NavBar } from './NavBar';
import styles from './AppLayout.module.scss';

/** Authenticated app shell: a slim top bar (identity + lock/logout), the routed
 * content, and the NavBar - a bottom bar on mobile, a left sidebar on desktop. */
export function AppLayout() {
  // The user-set display name, not the login identifier: a decoy vault's
  // identifier is an opaque server-assigned id we must never surface.
  const { data: displayName } = useDisplayName();
  const { isDesktop } = useResponsive();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className={isDesktop ? `${styles.shell} ${styles.shellDesktop}` : styles.shell}>
      {isDesktop && (
        <aside className={styles.sidebar}>
          <NavBar desktop />
        </aside>
      )}

      <div className={styles.main}>
        <header className={styles.topBar}>
          <span className={styles.brand}>Open Cycle Tracker</span>
          <div className={styles.right}>
            {displayName && <span className={styles.user}>{displayName}</span>}
            <button type="button" className={styles.linkBtn} onClick={() => useVault.getState().relock()}>
              {t('layout.lock')}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={async () => {
                await logoutAccount();
                navigate('/login', { replace: true });
              }}
            >
              {t('layout.logout')}
            </button>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>

        {!isDesktop && <NavBar desktop={false} />}
      </div>
    </div>
  );
}
