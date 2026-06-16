import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { loginAccount } from '@/auth/session';
import { Button } from '@/components/Button';

export function Login() {
  // Controlled inputs: React holds the value in state and the input reflects it.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginAccount({ identifier, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('auth.login.title')}>
      <form onSubmit={onSubmit}>
        <Field
          id="identifier"
          label={t('fields.username')}
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <Field
          id="password"
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <Button type="submit" disabled={busy || !identifier || !password}>
            {busy ? <Spinner size="sm" label={t('auth.login.deriving')} /> : t('auth.login.submit')}
          </Button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/register">{t('auth.login.createAccount')}</Link>
        <Link to="/recover">{t('auth.login.forgot')}</Link>
      </div>
    </AuthCard>
  );
}
