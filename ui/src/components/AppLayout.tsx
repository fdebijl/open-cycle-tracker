import { Outlet, useNavigate } from 'react-router-dom';
import { logoutAccount } from '@/auth/session';
import { useVault } from '@/stores/vault';
import { useResponsive } from '@/hooks/useResponsive';
import { NavBar } from './NavBar';
import styles from './AppLayout.module.scss';

/** Authenticated app shell: a slim top bar (identity + lock/logout), the routed
 * content, and the NavBar — a bottom bar on mobile, a left sidebar on desktop. */
export function AppLayout() {
  const identifier = useVault((s) => s.session?.user.identifier);
  const { isDesktop } = useResponsive();
  const navigate = useNavigate();

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
            <span className={styles.user}>{identifier}</span>
            <button type="button" className={styles.linkBtn} onClick={() => useVault.getState().relock()}>
              Lock
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={async () => {
                await logoutAccount();
                navigate('/login', { replace: true });
              }}
            >
              Log out
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
