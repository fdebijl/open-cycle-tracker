import { parseISO } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useVault } from '@/stores/vault';
import { categoriesApi, categoryLevelsApi, cyclesApi, daysApi, factorsApi, usersApi } from '@/api/resources';
import { recoverInit } from '@/api/auth';
import { encryptString } from '@/crypto';
import {
  decryptAll,
  decryptCategory,
  decryptCategoryLevel,
  decryptDay,
  decryptFactor,
  decryptSettings,
  decryptUserName,
  encryptDayFields,
  encryptSettings,
  encryptUserName,
} from './mappers';
import { computePeriodDayIds, flowPeriodLevelIds } from './cycles';
import {
  buildBackupDocument,
  decryptEncryptedFile,
  encodeEncryptedFile,
  encodePlaintextFile,
  parseBackupFile,
  planImport,
} from './backup';
import type { BackupDocument, ImportCounts } from './backup';
import type { Cycle } from './types';

/**
 * I/O orchestration around the pure `backup.ts` core: gather + decrypt for
 * export, and parse + decrypt + re-create for import. Both re-encrypt under the
 * current session's DEK, so nothing plaintext is ever sent to the server.
 */

/** Trigger a browser download of `text` as a file. The app has no other file
 * handling, so this is intentionally minimal. */
function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupFilename(encrypted: boolean): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `open-cycle-tracker-backup-${stamp}-${encrypted ? 'encrypted' : 'plaintext'}.json`;
}

/** Export the full dataset as an encrypted (recovery-phrase-unlocked) or
 * plaintext JSON file and trigger its download. */
export function useExportBackup() {
  const dek = useVault((s) => s.dek);
  const session = useVault((s) => s.session);
  return useMutation({
    mutationFn: async ({ encrypted }: { encrypted: boolean }): Promise<void> => {
      if (!dek || !session) throw new Error('Vault is locked');
      const userId = session.user.id;

      const [cycleDtos, dayDtos, factorDtos, categoryDtos, levelDtos, userDto] = await Promise.all([
        cyclesApi.list(),
        daysApi.list(),
        factorsApi.list(),
        categoriesApi.list(),
        categoryLevelsApi.list(),
        usersApi.get(userId),
      ]);

      const [days, factors, categories, levels] = await Promise.all([
        decryptAll(dayDtos, dek, decryptDay),
        decryptAll(factorDtos, dek, decryptFactor),
        decryptAll(categoryDtos, dek, decryptCategory),
        decryptAll(levelDtos, dek, decryptCategoryLevel),
      ]);
      const settings = await decryptSettings(userDto, dek);
      const displayName = await decryptUserName(userDto, dek);

      const cycles: Cycle[] = cycleDtos.map((c) => ({ id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt }));

      const doc = buildBackupDocument({
        cycles,
        days,
        factors,
        categories,
        levels,
        settings,
        displayName,
        meta: { exportedAt: new Date().toISOString(), appName: 'Open Cycle Tracker', appVersion: __APP_VERSION__ },
      });

      let text: string;
      if (encrypted) {
        const rec = await recoverInit(session.user.identifier);
        text = await encodeEncryptedFile(doc, dek, {
          kdf: rec.kdfParams,
          saltRecovery: rec.saltRecovery,
          wrappedDekRecovery: rec.wrappedDekRecovery,
        });
      } else {
        text = encodePlaintextFile(doc);
      }
      downloadTextFile(backupFilename(encrypted), text);
    },
  });
}

/** Import a backup file (encrypted or plaintext), merging into the current
 * account: new records are created, dates already present are skipped. Returns
 * the resulting counts for display. */
export function useImportBackup() {
  const dek = useVault((s) => s.dek);
  const session = useVault((s) => s.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, recoveryPhrase }: { text: string; recoveryPhrase?: string }): Promise<ImportCounts> => {
      if (!dek || !session) throw new Error('Vault is locked');
      const userId = session.user.id;

      const parsed = parseBackupFile(text);
      const doc: BackupDocument = parsed.encrypted
        ? await decryptEncryptedFile(parsed.file, recoveryPhrase ?? '')
        : parsed.document;

      // Snapshot the target account so the plan resolves global refs, dedups by
      // date, and matches existing cycles by onset.
      const [cycleDtos, dayDtos, factorDtos, categoryDtos, levelDtos, userDto] = await Promise.all([
        cyclesApi.list(),
        daysApi.list(),
        factorsApi.list(),
        categoriesApi.list(),
        categoryLevelsApi.list(),
        usersApi.get(userId),
      ]);
      const [existingDays, targetCategories, targetLevels] = await Promise.all([
        decryptAll(dayDtos, dek, decryptDay),
        decryptAll(categoryDtos, dek, decryptCategory),
        decryptAll(levelDtos, dek, decryptCategoryLevel),
      ]);
      const existingCycles: Cycle[] = cycleDtos.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      const existingPeriodDayIds = computePeriodDayIds(
        factorDtos,
        flowPeriodLevelIds(targetCategories, targetLevels),
      );
      const existingDisplayName = await decryptUserName(userDto, dek);
      const existingSettings = userDto.encSettings ? await decryptSettings(userDto, dek) : null;

      const plan = planImport(doc, {
        existingCycles,
        existingDays,
        targetCategories,
        targetLevels,
        existingDisplayName,
        existingSettings,
        existingPeriodDayIds,
      });
      const counts = { ...plan.counts };

      // 1. Re-create user-defined categories + levels, mapping doc-local ids to
      //    the new target ids so user-scoped factor refs resolve.
      const userLevelMap = new Map<string, string>();
      for (const cat of plan.userCategories) {
        const created = await categoriesApi.create({
          encName: await encryptString(cat.name, dek),
          encIcon: cat.icon ? await encryptString(cat.icon, dek) : undefined,
          encColor: cat.color ? await encryptString(cat.color, dek) : undefined,
        });
        for (const level of cat.levels) {
          const createdLevel = await categoryLevelsApi.create({
            categoryId: created.id,
            encName: await encryptString(level.name, dek),
            encIcon: level.icon ? await encryptString(level.icon, dek) : undefined,
          });
          userLevelMap.set(`${cat.localId}::${level.localId}`, createdLevel.id);
        }
      }

      // 2. Re-create cycles (or merge into existing ones), their days, factors.
      for (const pc of plan.cycles) {
        const cycleId = pc.existingCycleId ?? (await cyclesApi.create()).id;
        for (const day of pc.days) {
          const enc = await encryptDayFields({ date: parseISO(day.date), notes: day.notes }, dek);
          const created = await daysApi.create({
            cycleId,
            encDate: enc.encDate,
            encNotes: enc.encNotes,
            order: day.order,
          });
          for (const f of day.factors) {
            let categoryLevelId: string | undefined;
            if (f.level.kind === 'global') {
              categoryLevelId = f.level.categoryLevelId;
            } else {
              categoryLevelId = userLevelMap.get(`${f.level.categoryLocalId}::${f.level.levelLocalId}`);
            }
            if (!categoryLevelId) {
              counts.factorsToCreate -= 1;
              counts.factorsUnresolved += 1;
              continue;
            }
            await factorsApi.create({
              dayId: created.id,
              categoryLevelId,
              encNotes: f.notes ? await encryptString(f.notes, dek) : undefined,
              encValue: f.value != null ? await encryptString(String(f.value), dek) : undefined,
            });
          }
        }
      }

      // 3. Restore name/settings only into a fresh account (never clobber).
      if (plan.restoreDisplayName) {
        await usersApi.update(userId, { encName: await encryptUserName(doc.displayName, dek) });
      }
      if (plan.restoreSettings) {
        await usersApi.update(userId, { encSettings: await encryptSettings(doc.settings, dek) });
      }

      return counts;
    },
    onSuccess: () => {
      const userId = session?.user.id;
      for (const key of ['cycles', 'days', 'factors', 'categories', 'categoryLevels', 'settings', 'displayName']) {
        queryClient.invalidateQueries({ queryKey: [key, userId] });
      }
    },
  });
}
