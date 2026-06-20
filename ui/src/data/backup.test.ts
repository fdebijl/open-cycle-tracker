import { describe, expect, it } from 'vitest';
import { aeadEncrypt, interactiveKdfParams, randomBytes } from '@/crypto/primitives';
import { toBase64 } from '@/crypto/codec';
import { secretToMnemonic } from '@/crypto';
import { deriveKey } from '@/crypto/kdf';
import {
  BackupError,
  buildBackupDocument,
  decryptEncryptedFile,
  encodeEncryptedFile,
  encodePlaintextFile,
  parseBackupFile,
  planImport,
} from './backup';
import type { RecoveryMaterial } from './backup';
import { DEFAULT_USER_SETTINGS } from './types';
import type { Category, CategoryLevel, Cycle, Day, Factor } from './types';

// ---- Fixtures (source instance) ------------------------------------------

const categories: Category[] = [
  { id: 'cat-flow', userId: null, global: true, slug: 'flow', name: 'Flow', icon: 'water', color: '#e76666' },
  { id: 'cat-mood', userId: null, global: true, slug: null, name: 'Mood', icon: 'mood', color: '#6aa' },
];
const levels: CategoryLevel[] = [
  { id: 'lvl-flow-light', categoryId: 'cat-flow', order: 1, name: 'Light', icon: '' },
  { id: 'lvl-flow-heavy', categoryId: 'cat-flow', order: 3, name: 'Heavy', icon: '' },
  { id: 'lvl-mood-pms', categoryId: 'cat-mood', order: 5, name: 'PMS', icon: '' },
];
const cycles: Cycle[] = [{ id: 'cyc1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }];
const days: Day[] = [
  { id: 'day1', cycleId: 'cyc1', order: 0, date: new Date(2026, 0, 1), notes: 'cramps' },
  { id: 'day2', cycleId: 'cyc1', order: 1, date: new Date(2026, 0, 2), notes: null },
];
const factors: Factor[] = [
  { id: 'f1', dayId: 'day1', categoryLevelId: 'lvl-flow-heavy', notes: null, value: null },
  { id: 'f2', dayId: 'day2', categoryLevelId: 'lvl-mood-pms', notes: 'irritable', value: null },
];

const meta = { exportedAt: '2026-06-20T00:00:00Z', appName: 'Open Cycle Tracker', appVersion: '1.2.3' };

function buildDoc(displayName = 'Alice') {
  return buildBackupDocument({ cycles, days, factors, categories, levels, settings: DEFAULT_USER_SETTINGS, displayName, meta });
}

// Target instance globals - deliberately DIFFERENT uuids to prove remapping.
const targetCategories: Category[] = [
  { id: 'tcat-flow', userId: null, global: true, slug: 'flow', name: 'Flow', icon: 'water', color: '#e76666' },
  { id: 'tcat-mood', userId: null, global: true, slug: null, name: 'Mood', icon: 'mood', color: '#6aa' },
];
const targetLevels: CategoryLevel[] = [
  { id: 'tflow-light', categoryId: 'tcat-flow', order: 1, name: 'Light', icon: '' },
  { id: 'tflow-heavy', categoryId: 'tcat-flow', order: 3, name: 'Heavy', icon: '' },
  { id: 'tmood-pms', categoryId: 'tcat-mood', order: 5, name: 'PMS', icon: '' },
];

const freshCtx = {
  existingCycles: [] as Cycle[],
  existingDays: [] as Day[],
  targetCategories,
  targetLevels,
  existingDisplayName: '',
  existingSettings: null,
};

describe('buildBackupDocument', () => {
  it('groups days under cycles and factors under days, with stable refs', () => {
    const doc = buildDoc();
    expect(doc.cycles).toHaveLength(1);
    expect(doc.cycles[0].days.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02']);
    const heavy = doc.cycles[0].days[0].factors[0];
    expect(heavy.ref).toEqual({ scope: 'global', categorySlug: 'flow', categoryName: 'Flow', levelName: 'Heavy', levelOrder: 3 });
    const pms = doc.cycles[0].days[1].factors[0];
    expect(pms).toMatchObject({ notes: 'irritable', ref: { scope: 'global', categoryName: 'Mood', levelName: 'PMS' } });
    expect(doc.userCategories).toEqual([]);
  });
});

describe('plaintext file round-trip', () => {
  it('encodes and parses back to the same document', () => {
    const doc = buildDoc();
    const parsed = parseBackupFile(encodePlaintextFile(doc));
    expect(parsed.encrypted).toBe(false);
    if (!parsed.encrypted) expect(parsed.document).toEqual(doc);
  });
});

describe('encrypted file round-trip', () => {
  // Build recovery material the same shape `recoverInit` returns, by wrapping a
  // DEK under a recovery-phrase-derived KEK.
  async function makeRecovery(dek: Uint8Array, mnemonic: string): Promise<RecoveryMaterial> {
    const kdf = await interactiveKdfParams();
    const salt = await randomBytes(16);
    const { mnemonicToRecoveryCode } = await import('@/crypto');
    const recoveryCode = await mnemonicToRecoveryCode(mnemonic);
    const recoveryKek = await deriveKey(recoveryCode, salt, kdf);
    return {
      kdf,
      saltRecovery: await toBase64(salt),
      wrappedDekRecovery: await toBase64(await aeadEncrypt(dek, recoveryKek)),
    };
  }

  it('decrypts with the correct recovery phrase', async () => {
    const dek = await randomBytes(32);
    const mnemonic = secretToMnemonic(await randomBytes(32));
    const recovery = await makeRecovery(dek, mnemonic);

    const doc = buildDoc();
    const file = parseBackupFile(await encodeEncryptedFile(doc, dek, recovery));
    expect(file.encrypted).toBe(true);
    if (file.encrypted) {
      const out = await decryptEncryptedFile(file.file, mnemonic);
      expect(out).toEqual(doc);
    }
  });

  it('rejects a wrong (but valid) recovery phrase', async () => {
    const dek = await randomBytes(32);
    const mnemonic = secretToMnemonic(await randomBytes(32));
    const recovery = await makeRecovery(dek, mnemonic);
    const wrong = secretToMnemonic(await randomBytes(32));

    const file = parseBackupFile(await encodeEncryptedFile(buildDoc(), dek, recovery));
    if (file.encrypted) {
      await expect(decryptEncryptedFile(file.file, wrong)).rejects.toBeInstanceOf(BackupError);
    }
  });
});

describe('parseBackupFile validation', () => {
  it('rejects non-JSON', () => {
    expect(() => parseBackupFile('not json')).toThrow(BackupError);
  });
  it('rejects a file with the wrong format marker', () => {
    expect(() => parseBackupFile(JSON.stringify({ format: 'something-else', schema: 1 }))).toThrow(BackupError);
  });
  it('rejects a newer schema', () => {
    const text = JSON.stringify({ format: 'oct-backup', encrypted: false, schema: 2, document: {} });
    expect(() => parseBackupFile(text)).toThrow('unsupported-schema');
  });
});

describe('planImport', () => {
  it('remaps global refs onto target uuids and restores name/settings into a fresh account', () => {
    const plan = planImport(buildDoc(), freshCtx);
    expect(plan.cycles).toHaveLength(1);
    expect(plan.cycles[0].existingCycleId).toBeNull();
    expect(plan.counts).toMatchObject({ cyclesToCreate: 1, daysToCreate: 2, daysSkipped: 0, factorsToCreate: 2, factorsUnresolved: 0 });
    const levelIds = plan.cycles[0].days.flatMap((d) => d.factors.map((f) => f.level.kind === 'global' && f.level.categoryLevelId));
    expect(levelIds).toEqual(['tflow-heavy', 'tmood-pms']);
    expect(plan.restoreDisplayName).toBe(true);
    expect(plan.restoreSettings).toBe(true);
  });

  it('falls back to name matching when the slug is absent, and counts unresolved refs', () => {
    // A doc factor referencing a category that the target lacks entirely.
    const doc = buildBackupDocument({
      cycles,
      days: [days[0]],
      factors: [
        { id: 'fx', dayId: 'day1', categoryLevelId: 'lvl-flow-heavy', notes: null, value: null },
        { id: 'fy', dayId: 'day1', categoryLevelId: 'lvl-mood-pms', notes: null, value: null },
      ],
      categories,
      levels,
      settings: DEFAULT_USER_SETTINGS,
      displayName: '',
      meta,
    });
    // Target keeps Mood (matched by name, no slug) but drops Flow entirely.
    const plan = planImport(doc, {
      ...freshCtx,
      targetCategories: [targetCategories[1]],
      targetLevels: [targetLevels[2]],
    });
    expect(plan.counts.factorsUnresolved).toBe(1); // flow heavy can't match
    expect(plan.counts.factorsToCreate).toBe(1); // mood pms matched by name
    expect(plan.cycles[0].days[0].factors[0].level).toEqual({ kind: 'global', categoryLevelId: 'tmood-pms' });
  });

  it('dedups by date and merges into an existing cycle with the same onset', () => {
    const existingCycles: Cycle[] = [{ id: 'ec1', createdAt: '', updatedAt: '' }];
    const existingDays: Day[] = [{ id: 'ed1', cycleId: 'ec1', order: 0, date: new Date(2026, 0, 1), notes: null }];
    const plan = planImport(buildDoc(), { ...freshCtx, existingCycles, existingDays });

    expect(plan.counts).toMatchObject({ daysToCreate: 1, daysSkipped: 1, cyclesToCreate: 0 });
    expect(plan.cycles[0].existingCycleId).toBe('ec1'); // same onset (2026-01-01)
    expect(plan.cycles[0].days.map((d) => d.date)).toEqual(['2026-01-02']);
  });

  it('never clobbers an existing name or settings on merge', () => {
    const plan = planImport(buildDoc(), { ...freshCtx, existingDisplayName: 'Bob', existingSettings: DEFAULT_USER_SETTINGS });
    expect(plan.restoreDisplayName).toBe(false);
    expect(plan.restoreSettings).toBe(false);
  });
});
