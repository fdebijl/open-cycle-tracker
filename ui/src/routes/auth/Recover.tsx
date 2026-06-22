import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { recoverAccountWithMnemonic } from '@/auth/session';

export function Recover() {
  const [identifier, setIdentifier] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await recoverAccountWithMnemonic({ identifier, mnemonic, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.recover.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title={t('auth.recover.resetTitle')}>
        <p>{t('auth.recover.resetDone')}</p>
        <div className="oct-form-actions">
          <button type="button" className="oct-primary" onClick={() => navigate('/login', { replace: true })}>
            {t('auth.recover.goToLogin')}
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.recover.title')}>
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
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="mnemonic" style={{ fontSize: 13, color: 'var(--oct-muted)' }}>
            {t('auth.recover.phraseLabel')}
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
          label={t('auth.recover.newPassword')}
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
            {busy ? <Spinner size="sm" label={t('auth.recover.recovering')} /> : t('auth.recover.submit')}
          </button>
        </div>
      </form>
      <div className="oct-muted-links">
        <Link to="/login">{t('auth.recover.backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}
