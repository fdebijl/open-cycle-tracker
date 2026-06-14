import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { EmergencyDelete } from '@/components/EmergencyDelete';
import { changePassword, deleteAccount } from '@/auth/session';
import { useVault } from '@/stores/vault';
import styles from './Settings.module.scss';

export function Settings() {
  const user = useVault((s) => s.session?.user);
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
          <dt>Username</dt>
          <dd>{user?.identifier}</dd>
          <dt>Email</dt>
          <dd>{user?.email ?? <span className={styles.muted}>none</span>}</dd>
        </dl>
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
