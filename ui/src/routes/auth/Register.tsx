import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { registerAccount } from '@/auth/session';
import { Button } from '@/components/Button';

export function Register() {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const { recoveryMnemonic } = await registerAccount({
        identifier,
        password,
        email: email.trim() || undefined,
      });

      navigate('/onboarding', { replace: true, state: { mnemonic: recoveryMnemonic } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.register.failed'));
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('auth.register.title')}>
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
          id="email"
          label={t('auth.register.emailOptional')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <Field
          id="password"
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <Field
          id="confirm"
          label={t('auth.register.confirmPassword')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <Button type="submit" disabled={busy || !identifier || !password || !confirm}>
            {busy ? <Spinner size="sm" label={t('auth.register.generating')} /> : t('auth.register.submit')}
          </Button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/login">{t('auth.register.backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}
