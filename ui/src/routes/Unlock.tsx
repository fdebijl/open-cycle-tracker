import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { logoutAccount, unlockWithPassword } from '@/auth/session';
import { useVault } from '@/stores/vault';

/**
 * Shown after an auto-lock: the session (token) is still held, but the DEK was
 * wiped from memory. The user re-enters their password to re-derive it - no
 * network round-trip needed.
 */
export function Unlock() {
  const identifier = useVault((s) => s.session?.user.identifier);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await unlockWithPassword(password);
      navigate('/', { replace: true });
    } catch {
      setError('Incorrect password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Locked">
      <p className="oct-error" style={{ color: 'var(--oct-muted)' }}>
        Signed in as <strong>{identifier}</strong>. Enter your password to unlock.
      </p>
      <form onSubmit={onSubmit}>
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoFocus
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <button type="submit" className="oct-primary" disabled={busy || !password}>
            {busy ? <Spinner size="sm" label="Deriving key…" /> : 'Unlock'}
          </button>
        </div>
      </form>
      <div className="oct-muted-links">
        <button
          type="button"
          onClick={async () => {
            await logoutAccount();
            navigate('/login', { replace: true });
          }}
          style={{ background: 'none', border: 'none', color: 'var(--oct-blue)', cursor: 'pointer', padding: 0 }}
        >
          Log out instead
        </button>
      </div>
    </AuthCard>
  );
}
