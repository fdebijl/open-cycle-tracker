import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { loginAccount } from '@/auth/session';

export function Login() {
  // Controlled inputs: React holds the value in state and the input reflects it.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginAccount({ identifier, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Log in">
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
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <button type="submit" className="oct-primary" disabled={busy || !identifier || !password}>
            {busy ? <Spinner label="Deriving key…" /> : 'Log in'}
          </button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/register">Create account</Link>
        <Link to="/recover">Forgot password?</Link>
      </div>
    </AuthCard>
  );
}
