import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { useDisplayName, useUpdateDisplayName } from '@/data/hooks';
import { useVault } from '@/stores/vault';
import styles from './Settings.module.scss';

export function ProfileSettings() {
  const user = useVault((s) => s.session?.user);
  const { t } = useTranslation();

  const { data: displayName } = useDisplayName();
  const updateDisplayName = useUpdateDisplayName();
  const [draftName, setDraftName] = useState<string | null>(null);
  const nameValue = draftName ?? displayName ?? '';
  const nameUnchanged = nameValue.trim() === (displayName ?? '');

  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    await updateDisplayName.mutateAsync(nameValue);
    setDraftName(null);
  }

  return (
    <div className={styles.card}>
      <h2>{t('settings.account')}</h2>
      <dl className={styles.account}>
        <dt>{t('settings.email')}</dt>
        <dd>{user?.email ?? <span className={styles.muted}>{t('settings.emailNone')}</span>}</dd>
      </dl>
      <form onSubmit={onSaveName}>
        <Field
          id="displayName"
          label={t('settings.displayName')}
          type="text"
          autoComplete="off"
          value={nameValue}
          onChange={(e) => setDraftName(e.target.value)}
          disabled={updateDisplayName.isPending}
        />
        <p className={styles.muted}>{t('settings.displayNameHint')}</p>
        <Button type="submit" disabled={updateDisplayName.isPending || nameUnchanged}>
          {updateDisplayName.isPending ? <Spinner size="sm" label={t('settings.saving')} /> : t('settings.saveDisplayName')}
        </Button>
      </form>
    </div>
  );
}
