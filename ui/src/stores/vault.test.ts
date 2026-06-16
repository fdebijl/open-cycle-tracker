// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAutoLock, useVault } from './vault';
import { AUTO_LOCK_MS } from '@/config/env';
import type { Session } from './vault';

const fakeSession = {
  token: 't',
  user: { id: 'u1' },
  saltAuth: '',
  saltKek: '',
  wrappedDek: '',
  kdfParams: {},
} as unknown as Session;

const dek = () => new Uint8Array(32);

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  useVault.getState().logout();
  useVault.setState({ autoLockMs: AUTO_LOCK_MS, lockOnHidden: true });
});

afterEach(() => {
  useVault.getState().logout();
});

describe('vault inactivity auto-lock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('wipes the DEK after the inactivity timeout but keeps the session', () => {
    useVault.getState().setSession(fakeSession, dek());
    vi.advanceTimersByTime(AUTO_LOCK_MS - 1);
    expect(useVault.getState().dek).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(useVault.getState().dek).toBeNull();
    expect(useVault.getState().session).not.toBeNull();
  });

  it('reschedules with the new timeout when setAutoLockConfig changes it', () => {
    useVault.getState().setSession(fakeSession, dek());
    useVault.getState().setAutoLockConfig({ autoLockMs: 10 * 60 * 1000, lockOnHidden: true });
    // Past the old 5-min default, but the timer was rescheduled to 10 min.
    vi.advanceTimersByTime(AUTO_LOCK_MS);
    expect(useVault.getState().dek).not.toBeNull();
    vi.advanceTimersByTime(10 * 60 * 1000 - AUTO_LOCK_MS);
    expect(useVault.getState().dek).toBeNull();
  });

  it('noteActivity resets the inactivity timer', () => {
    useVault.getState().setSession(fakeSession, dek());
    vi.advanceTimersByTime(AUTO_LOCK_MS - 1000);
    useVault.getState().noteActivity();
    vi.advanceTimersByTime(2000);
    expect(useVault.getState().dek).not.toBeNull();
  });
});

describe('installAutoLock tab-hidden handling', () => {
  it('locks when the tab is hidden and lockOnHidden is true', () => {
    const cleanup = installAutoLock();
    useVault.getState().setSession(fakeSession, dek());
    useVault.getState().setAutoLockConfig({ autoLockMs: AUTO_LOCK_MS, lockOnHidden: true });
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useVault.getState().dek).toBeNull();
    cleanup();
  });

  it('stays unlocked when the tab is hidden and lockOnHidden is false', () => {
    const cleanup = installAutoLock();
    useVault.getState().setSession(fakeSession, dek());
    useVault.getState().setAutoLockConfig({ autoLockMs: AUTO_LOCK_MS, lockOnHidden: false });
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useVault.getState().dek).not.toBeNull();
    cleanup();
  });
});
