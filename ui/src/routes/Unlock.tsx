import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { logoutAccount, unlockWithPassword } from '@/auth/session';
import { useVault } from '@/stores/vault';
import { Button } from '@/components/Button';

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
  const { t } = useTranslation();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await unlockWithPassword(password);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.unlock.incorrect'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('auth.unlock.title')}>
      <p className="oct-error" style={{ color: 'var(--oct-muted)' }}>
        <Trans i18nKey="auth.unlock.signedInAs" values={{ name: identifier }}>
          Signed in as <strong>{identifier}</strong>. Enter your password to unlock.
        </Trans>
      </p>
      <form onSubmit={onSubmit}>
        <Field
          id="password"
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoFocus
        />
        {error && <p className="oct-error">{error}</p>}
        <div className="oct-form-actions">
          <Button type="submit" disabled={busy || !password}>
            {busy ? <Spinner size="sm" label={t('auth.unlock.deriving')} /> : t('auth.unlock.submit')}
          </Button>
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
          {t('auth.unlock.logoutInstead')}
        </button>
      </div>
    </AuthCard>
  );
}
