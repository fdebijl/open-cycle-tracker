import { create } from 'zustand';
import { AUTO_LOCK_MS } from '@/config/env';
import type { KdfParams } from '@/crypto/types';
import type { AuthUser } from '@/api/types';

/**
 * The in-memory key vault. This is the security core of the web client: the DEK
 * lives only here, in memory, never in localStorage/IndexedDB. A full page
 * reload wipes everything (so the user re-logs in on each launch);
 * an auto-lock wipes just the DEK while keeping the non-secret
 * wrapping material so the user can re-unlock with their password alone.
 */
export interface Session {
  token: string;
  user: AuthUser;
  /** Account login salt (stable across password changes); needed to re-derive the
   * authHash on a password change so duress/destruct verifiers keep matching. */
  saltAuth: string;
  /** Non-secret material needed to re-derive the DEK on unlock (base64). */
  saltKek: string;
  wrappedDek: string;
  kdfParams: KdfParams;
}

interface VaultState {
  /** Present when logged in (we hold a token). */
  session: Session | null;
  /** Present when unlocked (the data-encryption key is in memory). */
  dek: Uint8Array | null;

  /** Inactivity timeout before auto-lock, in ms. Seeded with the default and
   * overwritten from the user's decrypted settings once the vault is unlocked. */
  autoLockMs: number;
  /** Whether to lock the instant the tab is hidden (the user's preference). */
  lockOnHidden: boolean;

  /** After a successful login/signup: store session + unlock with the DEK. */
  setSession: (session: Session, dek: Uint8Array) => void;
  /** After a quick re-unlock (password re-derived the DEK; session unchanged). */
  setDek: (dek: Uint8Array) => void;
  /** After a password change: refresh the wrapping material used to re-unlock. */
  updateSessionKeyMaterial: (material: Pick<Session, 'saltKek' | 'wrappedDek' | 'kdfParams'>) => void;
  /** Apply the user's auto-lock preferences; reschedules the timer if unlocked. */
  setAutoLockConfig: (config: { autoLockMs: number; lockOnHidden: boolean }) => void;
  /** Auto-lock: wipe the DEK but keep the session for a password-only unlock. */
  relock: () => void;
  /** Full logout: wipe everything. */
  logout: () => void;
  /** Reset the inactivity timer. */
  noteActivity: () => void;
}

/** Best-effort zeroing of key bytes before we drop the reference. */
function wipe(bytes: Uint8Array | null) {
  bytes?.fill(0);
}

let lockTimer: ReturnType<typeof setTimeout> | null = null;

function clearLockTimer() {
  if (lockTimer !== null) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
}

export const useVault = create<VaultState>((set, get) => {
  function scheduleAutoLock() {
    clearLockTimer();
    lockTimer = setTimeout(() => get().relock(), get().autoLockMs);
  }

  return {
    session: null,
    dek: null,
    autoLockMs: AUTO_LOCK_MS,
    lockOnHidden: true,

    setSession: (session, dek) => {
      wipe(get().dek);
      set({ session, dek });
      scheduleAutoLock();
    },

    setDek: (dek) => {
      wipe(get().dek);
      set({ dek });
      scheduleAutoLock();
    },

    updateSessionKeyMaterial: (material) => {
      const { session } = get();
      if (session) set({ session: { ...session, ...material } });
    },

    setAutoLockConfig: ({ autoLockMs, lockOnHidden }) => {
      set({ autoLockMs, lockOnHidden });
      // Apply a changed timeout immediately rather than after the next activity.
      if (get().dek) scheduleAutoLock();
    },

    relock: () => {
      clearLockTimer();
      wipe(get().dek);
      set({ dek: null });
    },

    logout: () => {
      clearLockTimer();
      wipe(get().dek);
      set({ session: null, dek: null });
    },

    noteActivity: () => {
      // Only meaningful while unlocked; reschedule the wipe.
      if (get().dek) scheduleAutoLock();
    },
  };
});

/** Convenience selectors. */
export const useIsAuthenticated = () => useVault((s) => s.session !== null);
export const useIsUnlocked = () => useVault((s) => s.dek !== null);

/**
 * Wire up auto-lock triggers: lock the moment the tab is hidden (a seized,
 * backgrounded device should not retain the key) when the user has opted into
 * that, and reset the inactivity timer on user interaction. Call once from the
 * app shell; returns a cleanup fn.
 */
export function installAutoLock(): () => void {
  const onActivity = () => useVault.getState().noteActivity();
  const onVisibility = () => {
    const { lockOnHidden } = useVault.getState();
    if (lockOnHidden && document.visibilityState === 'hidden') useVault.getState().relock();
  };

  const activityEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'pointermove'];
  for (const evt of activityEvents) document.addEventListener(evt, onActivity, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    for (const evt of activityEvents) document.removeEventListener(evt, onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
