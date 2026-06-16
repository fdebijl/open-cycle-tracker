import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
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
import { useVault } from '@/stores/vault';
import styles from './Settings.module.scss';

export function SecuritySettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ kind: 'err', text: t('settings.passwordMismatch') });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setMsg({ kind: 'ok', text: t('settings.passwordChanged') });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setMsg({ kind: 'err', text: t('settings.currentPasswordIncorrect') });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    await deleteAccount();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <form className={styles.card} onSubmit={onChangePassword}>
        <h2>{t('settings.changePassword')}</h2>
        <Field
          id="current"
          label={t('settings.currentPassword')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
        />
        <Field
          id="new"
          label={t('settings.newPassword')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={busy}
        />
        <Field
          id="confirmNew"
          label={t('settings.confirmNewPassword')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}
        <Button type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? <Spinner size="sm" label={t('settings.rewrapping')} /> : t('settings.changePassword')}
        </Button>
      </form>

      <DuressSection />

      <div className={`${styles.card} ${styles.danger}`}>
        <h2>{t('settings.dangerZone')}</h2>
        <p className={styles.muted}>{t('settings.dangerHint')}</p>
        <EmergencyDelete label={t('settings.deleteAccount')} onConfirm={onDelete} />
      </div>
    </>
  );
}

function DuressSection() {
  const { t } = useTranslation();
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
      setMsg({ kind: 'err', text: t('settings.duress.genericError') });
    } finally {
      setBusy(false);
    }
  }

  async function onSetDuress(event: FormEvent) {
    event.preventDefault();
    if (duressPw !== duressConfirm) {
      setMsg({ kind: 'err', text: t('settings.duress.decoyMismatch') });
      return;
    }
    await run(async () => {
      await setDuressPassword(duressPw);
      setDuressOn(true);
      setDuressPw('');
      setDuressConfirm('');
    }, t('settings.duress.decoySet'));
  }

  async function onSetDestruct(event: FormEvent) {
    event.preventDefault();
    if (destructPw !== destructConfirm) {
      setMsg({ kind: 'err', text: t('settings.duress.destructMismatch') });
      return;
    }
    await run(async () => {
      await setDestructPassword(destructPw);
      setDestructOn(true);
      setDestructPw('');
      setDestructConfirm('');
    }, t('settings.duress.destructSet'));
  }

  return (
    <div className={styles.card}>
      <h2>{t('settings.duress.title')}</h2>
      <p className={styles.muted}>
        <Trans i18nKey="settings.duress.intro">
          Optional extra passwords for situations where someone may force you to open the app. Both must be{' '}
          <strong>different</strong> from your main password.
        </Trans>
      </p>

      <form onSubmit={onSetDuress}>
        <h3>
          {t('settings.duress.decoyHeading')}{' '}
          {duressOn && <span className={styles.ok}>{t('settings.duress.configured')}</span>}
        </h3>
        <p className={styles.muted}>{t('settings.duress.decoyDesc')}</p>
        <Field
          id="duressPw"
          label={duressOn ? t('settings.duress.newDecoyPassword') : t('settings.duress.decoyPassword')}
          type="password"
          autoComplete="new-password"
          value={duressPw}
          onChange={(e) => setDuressPw(e.target.value)}
          disabled={busy}
        />
        <Field
          id="duressConfirm"
          label={t('settings.duress.confirmDecoyPassword')}
          type="password"
          autoComplete="new-password"
          value={duressConfirm}
          onChange={(e) => setDuressConfirm(e.target.value)}
          disabled={busy}
        />
        <div className="row">
        <Button type="submit" disabled={busy || !duressPw || !duressConfirm}>
          {busy ? (
            <Spinner size="sm" label={t('settings.saving')} />
          ) : duressOn ? (
            t('settings.duress.replaceDecoy')
          ) : (
            t('settings.duress.setDecoy')
          )}
        </Button>
        {duressOn && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await clearDuressPassword();
                setDuressOn(false);
              }, t('settings.duress.decoyRemoved'))
            }
          >
            {t('settings.duress.removeDecoy')}
          </button>
        )}
        </div>
      </form>

      <form onSubmit={onSetDestruct}>
        <h3>
          {t('settings.duress.destructHeading')}{' '}
          {destructOn && <span className={styles.ok}>{t('settings.duress.configured')}</span>}
        </h3>
        <p className={styles.muted}>
          <Trans i18nKey="settings.duress.destructDesc">
            <strong>Irreversible.</strong> Entering this password at the login screen permanently destroys your account
            and all data - it then shows the same error as a wrong password. There is no recovery. Make sure you have an
            export elsewhere before relying on it.
          </Trans>
        </p>
        <Field
          id="destructPw"
          label={destructOn ? t('settings.duress.newDestructPassword') : t('settings.duress.destructPassword')}
          type="password"
          autoComplete="new-password"
          value={destructPw}
          onChange={(e) => setDestructPw(e.target.value)}
          disabled={busy}
        />
        <Field
          id="destructConfirm"
          label={t('settings.duress.confirmDestructPassword')}
          type="password"
          autoComplete="new-password"
          value={destructConfirm}
          onChange={(e) => setDestructConfirm(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !destructPw || !destructConfirm}>
          {busy ? (
            <Spinner size="sm" label={t('settings.saving')} />
          ) : destructOn ? (
            t('settings.duress.replaceDestruct')
          ) : (
            t('settings.duress.setDestruct')
          )}
        </Button>
        {destructOn && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await clearDestructPassword();
                setDestructOn(false);
              }, t('settings.duress.destructRemoved'))
            }
          >
            {t('settings.duress.removeDestruct')}
          </button>
        )}
      </form>

      {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}
    </div>
  );
}
