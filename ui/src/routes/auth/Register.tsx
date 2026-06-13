import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { registerAccount } from '@/auth/session';
import { RecoveryReveal } from './RecoveryReveal';

export function Register() {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { recoveryMnemonic } = await registerAccount({
        identifier,
        password,
        email: email.trim() || undefined,
      });
      // Account is created and unlocked; show the recovery phrase before entering.
      setMnemonic(recoveryMnemonic);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (mnemonic) {
    return (
      <AuthCard title="Save your recovery phrase">
        <RecoveryReveal mnemonic={mnemonic} onConfirm={() => navigate('/', { replace: true })} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create account">
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
        <Field
          id="email"
          label="Email (optional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <Field
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <button type="submit" className="oct-primary" disabled={busy || !identifier || !password || !confirm}>
            {busy ? <Spinner label="Generating keys…" /> : 'Create account'}
          </button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/login">Back to login</Link>
      </div>
    </AuthCard>
  );
}
