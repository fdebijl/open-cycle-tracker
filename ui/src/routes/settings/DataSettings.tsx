import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { useExportBackup, useImportBackup } from '@/data/backup.hooks';
import { BackupError, parseBackupFile } from '@/data/backup';
import type { ImportCounts } from '@/data/backup';
import styles from './Settings.module.scss';

type Msg = { kind: 'ok' | 'err'; text: string };

/** Map a BackupError code to a user-facing, translated message. */
function backupErrorKey(err: unknown): string {
  if (err instanceof BackupError) {
    switch (err.message) {
      case 'bad-phrase':
        return 'settings.data.badPhrase';
      case 'unsupported-schema':
        return 'settings.data.unsupportedSchema';
      default:
        return 'settings.data.badFile';
    }
  }
  return 'settings.data.importError';
}

export function DataSettings() {
  return (
    <>
      <ExportSection />
      <ImportSection />
    </>
  );
}

function ExportSection() {
  const { t } = useTranslation();
  const exportBackup = useExportBackup();
  const [encrypted, setEncrypted] = useState(true);
  const [msg, setMsg] = useState<Msg | null>(null);

  async function onExport() {
    setMsg(null);
    try {
      await exportBackup.mutateAsync({ encrypted });
    } catch {
      setMsg({ kind: 'err', text: t('settings.data.exportError') });
    }
  }

  return (
    <div className={styles.card}>
      <h2>{t('settings.data.exportTitle')}</h2>
      <p className={styles.muted}>{t('settings.data.exportIntro')}</p>

      <label className={styles.toggleRow}>
        <input
          type="radio"
          name="exportFormat"
          checked={encrypted}
          onChange={() => setEncrypted(true)}
          disabled={exportBackup.isPending}
        />
        {t('settings.data.formatEncrypted')}
      </label>
      <p className={styles.muted}>{t('settings.data.formatEncryptedHint')}</p>

      <label className={styles.toggleRow}>
        <input
          type="radio"
          name="exportFormat"
          checked={!encrypted}
          onChange={() => setEncrypted(false)}
          disabled={exportBackup.isPending}
        />
        {t('settings.data.formatPlaintext')}
      </label>
      {!encrypted && (
        <p className={styles.err}>
          <Trans i18nKey="settings.data.plaintextWarning">
            <strong>Unprotected.</strong> Anyone who gets this file can read all your data.
          </Trans>
        </p>
      )}

      {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}
      <Button type="button" onClick={onExport} disabled={exportBackup.isPending}>
        {exportBackup.isPending ? (
          <Spinner size="sm" label={t('settings.data.exporting')} />
        ) : (
          t('settings.data.exportButton')
        )}
      </Button>
    </div>
  );
}

function ImportSection() {
  const { t } = useTranslation();
  const importBackup = useImportBackup();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [needsPhrase, setNeedsPhrase] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);
  const [result, setResult] = useState<ImportCounts | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    setResult(null);
    setPhrase('');
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    try {
      const parsed = parseBackupFile(content);
      setText(content);
      setFileName(file.name);
      setNeedsPhrase(parsed.encrypted);
    } catch (err) {
      setText(null);
      setFileName('');
      setNeedsPhrase(false);
      setMsg({ kind: 'err', text: t(backupErrorKey(err)) });
    }
  }

  async function onImport() {
    if (!text) return;
    setMsg(null);
    setResult(null);
    try {
      const counts = await importBackup.mutateAsync({ text, recoveryPhrase: needsPhrase ? phrase : undefined });
      setResult(counts);
      // Reset the picker so a second import starts clean.
      setText(null);
      setFileName('');
      setNeedsPhrase(false);
      setPhrase('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setMsg({ kind: 'err', text: t(backupErrorKey(err)) });
    }
  }

  return (
    <div className={styles.card}>
      <h2>{t('settings.data.importTitle')}</h2>
      <p className={styles.muted}>{t('settings.data.importIntro')}</p>

      <label className={styles.controlLabel} htmlFor="backupFile">
        {t('settings.data.chooseFile')}
      </label>
      <input
        id="backupFile"
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        disabled={importBackup.isPending}
      />
      {fileName && <p className={styles.muted}>{fileName}</p>}

      {needsPhrase && (
        <div style={{ margin: '14px 0' }}>
          <label className={styles.controlLabel} htmlFor="backupPhrase">
            {t('settings.data.phraseLabel')}
          </label>
          <textarea
            id="backupPhrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={importBackup.isPending}
            rows={3}
            style={{ width: '100%', font: 'inherit', padding: 10, borderRadius: 8, border: '1px solid var(--oct-border)' }}
          />
          <p className={styles.muted}>{t('settings.data.phraseHint')}</p>
        </div>
      )}

      {msg && <p className={msg.kind === 'err' ? styles.err : styles.ok}>{msg.text}</p>}

      {result && (
        <div className={styles.ok}>
          <strong>{t('settings.data.resultTitle')}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>{t('settings.data.resultDays', { count: result.daysToCreate })}</li>
            {result.daysSkipped > 0 && <li>{t('settings.data.resultSkipped', { count: result.daysSkipped })}</li>}
            {result.factorsUnresolved > 0 && (
              <li>{t('settings.data.resultUnresolved', { count: result.factorsUnresolved })}</li>
            )}
          </ul>
        </div>
      )}

      <Button
        type="button"
        onClick={onImport}
        disabled={importBackup.isPending || !text || (needsPhrase && !phrase.trim())}
      >
        {importBackup.isPending ? (
          <Spinner size="sm" label={t('settings.data.importing')} />
        ) : (
          t('settings.data.importButton')
        )}
      </Button>
    </div>
  );
}
