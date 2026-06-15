import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { recoverAccount } from '@/auth/session';

export function Recover() {
  const [identifier, setIdentifier] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await recoverAccount({ identifier, mnemonic, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Password reset">
        <p>Your password has been reset. You can now log in.</p>
        <div className="oct-form-actions">
          <button type="button" className="oct-primary" onClick={() => navigate('/login', { replace: true })}>
            Go to login
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Recover account">
      <form onSubmit={onSubmit}>
        <Field
          id="identifier"
          label="Username"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="mnemonic" style={{ fontSize: 13, color: 'var(--oct-muted)' }}>
            Recovery phrase (24 words)
          </label>
          <textarea
            id="mnemonic"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            disabled={busy}
            rows={3}
            style={{ width: '100%', font: 'inherit', padding: 10, borderRadius: 8, border: '1px solid var(--oct-border)' }}
          />
        </div>
        <Field
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <button
            type="submit"
            className="oct-primary"
            disabled={busy || !identifier || !mnemonic || !newPassword}
          >
            {busy ? <Spinner size="sm" label="Recovering…" /> : 'Reset password'}
          </button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/login">Back to login</Link>
      </div>
    </AuthCard>
  );
}
