import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { EmergencyDelete } from '@/components/EmergencyDelete';
import {
  changePassword,
  clearDestructPassword,
  clearDuressPassword,
  deleteAccount,
  setDestructPassword,
  setDuressPassword,
} from '@/auth/session';
import { usersApi } from '@/api/resources';
import { useDisplayName, useUpdateDisplayName } from '@/data/hooks';
import { useVault } from '@/stores/vault';
import styles from './Settings.module.scss';

export function Settings() {
  const user = useVault((s) => s.session?.user);
  const navigate = useNavigate();

  const { data: displayName } = useDisplayName();
  const updateDisplayName = useUpdateDisplayName();
  // `null` draft = not editing → show the saved name; a string = the live edit.
  const [draftName, setDraftName] = useState<string | null>(null);
  const nameValue = draftName ?? displayName ?? '';
  const nameUnchanged = nameValue.trim() === (displayName ?? '');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    await updateDisplayName.mutateAsync(nameValue);
    setDraftName(null);
  }

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ kind: 'err', text: 'New passwords do not match' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setMsg({ kind: 'ok', text: 'Password changed.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setMsg({ kind: 'err', text: 'Current password is incorrect.' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    await deleteAccount();
    navigate('/login', { replace: true });
  }

  return (
    <section className={styles.page}>
      <h1>Settings</h1>

      <div className={styles.card}>
        <h2>Account</h2>
        <dl className={styles.account}>
          <dt>Email</dt>
          <dd>{user?.email ?? <span className={styles.muted}>none</span>}</dd>
        </dl>
        <form onSubmit={onSaveName}>
          <Field
            id="displayName"
            label="Display name"
            type="text"
            autoComplete="off"
            value={nameValue}
            onChange={(e) => setDraftName(e.target.value)}
            disabled={updateDisplayName.isPending}
          />
          <p className={styles.muted}>Shown in the app. Stored encrypted - the server never sees it.</p>
          <button
            type="submit"
            className="oct-primary"
            disabled={updateDisplayName.isPending || nameUnchanged}
          >
            {updateDisplayName.isPending ? <Spinner label="Saving…" /> : 'Save display name'}
          </button>
        </form>
      </div>

      <form className={styles.card} onSubmit={onChangePassword}>
        <h2>Change password</h2>
        <Field
          id="current"
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
        />
        <Field
          id="new"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={busy}
        />
        <Field
          id="confirmNew"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}
        <button type="submit" className="oct-primary" disabled={busy || !current || !next || !confirm}>
          {busy ? <Spinner label="Re-wrapping key…" /> : 'Change password'}
        </button>
      </form>

      <DuressSection />

      <div className={`${styles.card} ${styles.danger}`}>
        <h2>Danger zone</h2>
        <p className={styles.muted}>
          Deleting your account permanently destroys all your encrypted data. This cannot be undone - and because the
          server cannot read your data, it cannot be recovered.
        </p>
        <EmergencyDelete label="Hold to delete account" onConfirm={onDelete} />
      </div>
    </section>
  );
}

/**
 * Decoy & duress passwords (roadmap #14).
 *
 * - The duress password opens a SEPARATE, empty vault ("decoy"). You can log in
 *   with it at any time to fill it with believable, mundane entries; under
 *   coercion you hand over this password instead of your real one. Your real
 *   data cannot be decrypted with it.
 * - The destruction password silently and permanently wipes your account the
 *   moment it is entered at the login screen - it looks exactly like a wrong
 *   password to whoever typed it.
 *
 * Nothing here tells you which vault you're in after login (that would tip off
 * an onlooker); you know by which password you used.
 */
function DuressSection() {
  const [duressOn, setDuressOn] = useState(false);
  const [destructOn, setDestructOn] = useState(false);

  const [duressPw, setDuressPw] = useState('');
  const [duressConfirm, setDuressConfirm] = useState('');
  const [destructPw, setDestructPw] = useState('');
  const [destructConfirm, setDestructConfirm] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const userId = useVault((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    usersApi
      .get(userId)
      .then((u) => {
        if (!active) return;
        setDuressOn(u.duressConfigured);
        setDestructOn(u.destructConfigured);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  async function run(action: () => Promise<void>, ok: string) {
    setMsg(null);
    setBusy(true);
    try {
      await action();
      setMsg({ kind: 'ok', text: ok });
    } catch {
      setMsg({ kind: 'err', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSetDuress(event: FormEvent) {
    event.preventDefault();
    if (duressPw !== duressConfirm) {
      setMsg({ kind: 'err', text: 'Decoy passwords do not match.' });
      return;
    }
    await run(async () => {
      await setDuressPassword(duressPw);
      setDuressOn(true);
      setDuressPw('');
      setDuressConfirm('');
    }, 'Decoy password set. Log in with it any time to fill the decoy vault.');
  }

  async function onSetDestruct(event: FormEvent) {
    event.preventDefault();
    if (destructPw !== destructConfirm) {
      setMsg({ kind: 'err', text: 'Destruction passwords do not match.' });
      return;
    }
    await run(async () => {
      await setDestructPassword(destructPw);
      setDestructOn(true);
      setDestructPw('');
      setDestructConfirm('');
    }, 'Destruction password set.');
  }

  return (
    <div className={styles.card}>
      <h2>Decoy &amp; duress</h2>
      <p className={styles.muted}>
        Optional extra passwords for situations where someone may force you to open the app. Both must be{' '}
        <strong>different</strong> from your main password.
      </p>

      <form onSubmit={onSetDuress}>
        <h3>Decoy password {duressOn && <span className={styles.ok}>· configured</span>}</h3>
        <p className={styles.muted}>
          Opens a separate, empty vault. Log in with this password whenever you like to add ordinary-looking entries so
          it appears used; hand it over under pressure. Your real data stays hidden and cannot be opened with it.
        </p>
        <Field
          id="duressPw"
          label={duressOn ? 'New decoy password' : 'Decoy password'}
          type="password"
          autoComplete="new-password"
          value={duressPw}
          onChange={(e) => setDuressPw(e.target.value)}
          disabled={busy}
        />
        <Field
          id="duressConfirm"
          label="Confirm decoy password"
          type="password"
          autoComplete="new-password"
          value={duressConfirm}
          onChange={(e) => setDuressConfirm(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="oct-primary" disabled={busy || !duressPw || !duressConfirm}>
          {busy ? <Spinner label="Saving…" /> : duressOn ? 'Replace decoy password' : 'Set decoy password'}
        </button>
        {duressOn && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await clearDuressPassword();
                setDuressOn(false);
              }, 'Decoy password removed and decoy vault deleted.')
            }
          >
            Remove decoy &amp; delete its data
          </button>
        )}
      </form>

      <form onSubmit={onSetDestruct}>
        <h3>Destruction password {destructOn && <span className={styles.ok}>· configured</span>}</h3>
        <p className={styles.muted}>
          <strong>Irreversible.</strong> Entering this password at the login screen permanently destroys your account
          and all data - it then shows the same error as a wrong password. There is no recovery. Make sure you have an
          export elsewhere before relying on it.
        </p>
        <Field
          id="destructPw"
          label={destructOn ? 'New destruction password' : 'Destruction password'}
          type="password"
          autoComplete="new-password"
          value={destructPw}
          onChange={(e) => setDestructPw(e.target.value)}
          disabled={busy}
        />
        <Field
          id="destructConfirm"
          label="Confirm destruction password"
          type="password"
          autoComplete="new-password"
          value={destructConfirm}
          onChange={(e) => setDestructConfirm(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="oct-primary" disabled={busy || !destructPw || !destructConfirm}>
          {busy ? <Spinner label="Saving…" /> : destructOn ? 'Replace destruction password' : 'Set destruction password'}
        </button>
        {destructOn && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await clearDestructPassword();
                setDestructOn(false);
              }, 'Destruction password removed.')
            }
          >
            Remove destruction password
          </button>
        )}
      </form>

      {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}
    </div>
  );
}
