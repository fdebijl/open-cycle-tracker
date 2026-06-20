import { format } from 'date-fns';
import { aeadDecrypt, aeadEncrypt } from '@/crypto/primitives';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from '@/crypto/codec';
import { mnemonicToRecoveryCode, recoverDek } from '@/crypto';
import type { KdfParams } from '@/crypto/types';
import { cycleOnset, FLOW_PERIOD_MIN_ORDER, FLOW_SLUG } from './cycles';
import type { Category, CategoryLevel, Cycle, Day, Factor, UserSettings } from './types';

/**
 * Encrypted/plaintext export + import of a user's full dataset (roadmap #5).
 *
 * Everything here is pure (no React, no API, no `Date.now`) so it can be
 * unit-tested like `prediction.ts`/`cycles.ts`. The orchestration that does
 * I/O around it lives in `backup.hooks.ts`.
 *
 * The export decrypts with the in-memory DEK and, for the encrypted file,
 * bundles the account's recovery-wrapping material (already served by
 * `POST /auth/recover/init`). Because that material wraps the same DEK the
 * payload is sealed with, the user's existing 24-word recovery phrase opens the
 * backup - it survives a lost password (it is keyed to the recovery phrase, not
 * the password) and a vanished server, while staying protected at rest.
 */

const ISO_DATE = 'yyyy-MM-dd';

export const BACKUP_FORMAT = 'oct-backup';
export const BACKUP_SCHEMA = 1;

// ---- The logical document (what an encrypted payload decrypts to) --------

/** How a factor's `categoryLevelId` is recorded so it can be re-resolved on a
 * different instance, where global-category UUIDs differ. */
export type CategoryLevelRef =
  | {
      scope: 'global';
      /** Stable slug when the category has one (e.g. `flow`); else null. */
      categorySlug: string | null;
      categoryName: string;
      levelName: string;
      levelOrder: number | null;
    }
  | {
      scope: 'user';
      /** Indexes into this document's `userCategories`. */
      categoryLocalId: string;
      levelLocalId: string;
    };

export interface BackupFactor {
  ref: CategoryLevelRef;
  notes: string | null;
  value: number | null;
}

export interface BackupDay {
  /** `yyyy-MM-dd`, the dedup key on import. */
  date: string;
  order: number | null;
  notes: string | null;
  factors: BackupFactor[];
}

export interface BackupCycle {
  localId: string;
  createdAt: string;
  days: BackupDay[];
}

export interface BackupUserLevel {
  localId: string;
  name: string;
  icon: string;
  order: number | null;
}

export interface BackupUserCategory {
  localId: string;
  slug: string | null;
  name: string;
  icon: string;
  color: string;
  levels: BackupUserLevel[];
}

export interface BackupDocument {
  exportedAt: string;
  app: { name: string; version: string };
  displayName: string;
  settings: UserSettings;
  userCategories: BackupUserCategory[];
  cycles: BackupCycle[];
}

// ---- File envelopes ------------------------------------------------------

export interface RecoveryMaterial {
  kdf: KdfParams;
  saltRecovery: string;
  wrappedDekRecovery: string;
}

interface EncryptedFile extends RecoveryMaterial {
  format: typeof BACKUP_FORMAT;
  encrypted: true;
  schema: number;
  /** base64 of `aeadEncrypt(JSON(document), dek)`. */
  payload: string;
}

interface PlaintextFile {
  format: typeof BACKUP_FORMAT;
  encrypted: false;
  schema: number;
  document: BackupDocument;
}

export type ParsedBackupFile =
  | { encrypted: true; schema: number; file: EncryptedFile }
  | { encrypted: false; schema: number; document: BackupDocument };

export class BackupError extends Error {}

// ---- Building the document (export) --------------------------------------

export interface BuildBackupInput {
  cycles: Cycle[];
  days: Day[];
  factors: Factor[];
  categories: Category[];
  levels: CategoryLevel[];
  settings: UserSettings;
  displayName: string;
  meta: { exportedAt: string; appName: string; appVersion: string };
}

/** Assemble the plaintext backup document from decrypted domain models. */
export function buildBackupDocument(input: BuildBackupInput): BackupDocument {
  const { cycles, days, factors, categories, levels, settings, displayName, meta } = input;

  const levelById = new Map(levels.map((l) => [l.id, l]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const factorsByDay = new Map<string, Factor[]>();
  for (const f of factors) {
    const list = factorsByDay.get(f.dayId);
    if (list) list.push(f);
    else factorsByDay.set(f.dayId, [f]);
  }

  const refFor = (categoryLevelId: string): CategoryLevelRef | null => {
    const level = levelById.get(categoryLevelId);
    if (!level) return null;
    const category = categoryById.get(level.categoryId);
    if (!category) return null;
    if (category.global) {
      return {
        scope: 'global',
        categorySlug: category.slug,
        categoryName: category.name,
        levelName: level.name,
        levelOrder: level.order,
      };
    }
    return { scope: 'user', categoryLocalId: category.id, levelLocalId: level.id };
  };

  const backupCycles: BackupCycle[] = cycles.map((c) => {
    const cycleDays = days
      .filter((d) => d.cycleId === c.id && d.date)
      .map((d): BackupDay => {
        const dayFactors = (factorsByDay.get(d.id) ?? [])
          .map((f): BackupFactor | null => {
            const ref = refFor(f.categoryLevelId);
            return ref ? { ref, notes: f.notes, value: f.value } : null;
          })
          .filter((f): f is BackupFactor => f !== null);
        return { date: format(d.date as Date, ISO_DATE), order: d.order, notes: d.notes, factors: dayFactors };
      });
    return { localId: c.id, createdAt: c.createdAt, days: cycleDays };
  });

  const userCategories: BackupUserCategory[] = categories
    .filter((c) => !c.global)
    .map((c) => ({
      localId: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
      levels: levels
        .filter((l) => l.categoryId === c.id)
        .map((l) => ({ localId: l.id, name: l.name, icon: l.icon, order: l.order })),
    }));

  return {
    exportedAt: meta.exportedAt,
    app: { name: meta.appName, version: meta.appVersion },
    displayName,
    settings,
    userCategories,
    cycles: backupCycles,
  };
}

// ---- Encoding / decoding files -------------------------------------------

export function encodePlaintextFile(doc: BackupDocument): string {
  const file: PlaintextFile = { format: BACKUP_FORMAT, encrypted: false, schema: BACKUP_SCHEMA, document: doc };
  return JSON.stringify(file, null, 2);
}

export async function encodeEncryptedFile(
  doc: BackupDocument,
  dek: Uint8Array,
  recovery: RecoveryMaterial,
): Promise<string> {
  const payload = await toBase64(await aeadEncrypt(utf8Encode(JSON.stringify(doc)), dek));
  const file: EncryptedFile = {
    format: BACKUP_FORMAT,
    encrypted: true,
    schema: BACKUP_SCHEMA,
    kdf: recovery.kdf,
    saltRecovery: recovery.saltRecovery,
    wrappedDekRecovery: recovery.wrappedDekRecovery,
    payload,
  };
  return JSON.stringify(file, null, 2);
}

/** Parse + validate a backup file's envelope (without decrypting). Throws a
 * `BackupError` for anything we don't recognise or can't restore. */
export function parseBackupFile(text: string): ParsedBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('not-json');
  }
  if (!parsed || typeof parsed !== 'object') throw new BackupError('not-a-backup');
  // A loose view of the raw JSON; `EncryptedFile & PlaintextFile` would collapse
  // the `encrypted: true & false` discriminant to `never`.
  const file = parsed as {
    format?: string;
    schema?: number;
    encrypted?: boolean;
    payload?: string;
    saltRecovery?: string;
    wrappedDekRecovery?: string;
    kdf?: KdfParams;
    document?: BackupDocument;
  };
  if (file.format !== BACKUP_FORMAT) throw new BackupError('not-a-backup');
  if (typeof file.schema !== 'number' || file.schema > BACKUP_SCHEMA) throw new BackupError('unsupported-schema');

  if (file.encrypted === true) {
    if (!file.payload || !file.saltRecovery || !file.wrappedDekRecovery || !file.kdf) {
      throw new BackupError('corrupt');
    }
    return { encrypted: true, schema: file.schema, file: file as unknown as EncryptedFile };
  }
  if (file.encrypted === false) {
    if (!file.document) throw new BackupError('corrupt');
    return { encrypted: false, schema: file.schema, document: file.document };
  }
  throw new BackupError('not-a-backup');
}

/** Decrypt an encrypted backup with the account's recovery phrase. Throws a
 * `BackupError('bad-phrase')` if the phrase doesn't open it. */
export async function decryptEncryptedFile(file: EncryptedFile, recoveryPhrase: string): Promise<BackupDocument> {
  let dek: Uint8Array;
  try {
    const recoveryCode = await mnemonicToRecoveryCode(recoveryPhrase);
    dek = await recoverDek(recoveryCode, file.saltRecovery, file.wrappedDekRecovery, file.kdf);
  } catch {
    // A malformed mnemonic (bad checksum) fails before the AEAD step.
    throw new BackupError('bad-phrase');
  }
  try {
    const plaintext = await aeadDecrypt(await fromBase64(file.payload), dek);
    return JSON.parse(utf8Decode(plaintext)) as BackupDocument;
  } catch {
    // AEAD tag mismatch ⇒ wrong (but well-formed) phrase, or a tampered file.
    throw new BackupError('bad-phrase');
  } finally {
    dek.fill(0);
  }
}

// ---- Planning an import --------------------------------------------------

/** A factor's level resolved against the target instance. User-category levels
 * stay symbolic until their category is created at apply time. */
export type ResolvedLevel =
  | { kind: 'global'; categoryLevelId: string }
  | { kind: 'user'; categoryLocalId: string; levelLocalId: string };

export interface PlannedFactor {
  level: ResolvedLevel;
  notes: string | null;
  value: number | null;
}

export interface PlannedDay {
  date: string;
  order: number | null;
  notes: string | null;
  factors: PlannedFactor[];
}

export interface PlannedCycle {
  /** An existing cycle to merge into (same onset), or null to create a new one. */
  existingCycleId: string | null;
  createdAt: string;
  days: PlannedDay[];
}

export interface ImportCounts {
  cyclesToCreate: number;
  daysToCreate: number;
  daysSkipped: number;
  factorsToCreate: number;
  factorsUnresolved: number;
}

export interface ImportPlan {
  /** User-defined categories to create (those not already present by name). */
  userCategories: BackupUserCategory[];
  cycles: PlannedCycle[];
  restoreDisplayName: boolean;
  restoreSettings: boolean;
  counts: ImportCounts;
}

export interface ImportContext {
  existingCycles: Cycle[];
  existingDays: Day[];
  targetCategories: Category[];
  targetLevels: CategoryLevel[];
  existingDisplayName: string;
  /** Null when the account has never written settings (a fresh account). */
  existingSettings: UserSettings | null;
  /** Period day ids for the existing data, so existing-cycle onsets match the
   * same way the rest of the app derives them. Optional. */
  existingPeriodDayIds?: Set<string>;
}

function isFlowPeriodRef(ref: CategoryLevelRef): boolean {
  return (
    ref.scope === 'global' &&
    (ref.categorySlug === FLOW_SLUG || ref.categoryName === 'Flow') &&
    (ref.levelOrder ?? 0) >= FLOW_PERIOD_MIN_ORDER
  );
}

/** A backup cycle's onset date string: earliest period day, else earliest day. */
function backupCycleOnset(cycle: BackupCycle): string | null {
  const dated = cycle.days.filter((d) => d.date).map((d) => d.date);
  if (dated.length === 0) return null;
  const periodDays = cycle.days.filter((d) => d.factors.some((f) => isFlowPeriodRef(f.ref))).map((d) => d.date);
  const pool = periodDays.length > 0 ? periodDays : dated;
  return pool.reduce((earliest, d) => (d < earliest ? d : earliest));
}

/**
 * Compute what an import would create, with global factor refs resolved to the
 * target's category-level ids, duplicate dates dropped, and each backup cycle
 * mapped onto an existing cycle (same onset) or marked for creation. Pure.
 */
export function planImport(doc: BackupDocument, ctx: ImportContext): ImportPlan {
  // Resolve a global ref to a target category-level id, or null if unmatched.
  const globalCats = ctx.targetCategories.filter((c) => c.global);
  const catBySlug = new Map(globalCats.filter((c) => c.slug).map((c) => [c.slug as string, c]));
  const catByName = new Map(globalCats.map((c) => [c.name, c]));
  const levelsByCategory = new Map<string, CategoryLevel[]>();
  for (const l of ctx.targetLevels) {
    const list = levelsByCategory.get(l.categoryId);
    if (list) list.push(l);
    else levelsByCategory.set(l.categoryId, [l]);
  }

  const resolveGlobal = (ref: Extract<CategoryLevelRef, { scope: 'global' }>): string | null => {
    const cat = (ref.categorySlug && catBySlug.get(ref.categorySlug)) || catByName.get(ref.categoryName);
    if (!cat) return null;
    const levels = levelsByCategory.get(cat.id) ?? [];
    const byName = levels.find((l) => l.name === ref.levelName);
    if (byName) return byName.id;
    const byOrder = ref.levelOrder != null ? levels.find((l) => l.order === ref.levelOrder) : undefined;
    return byOrder?.id ?? null;
  };

  // User categories to create: those whose name isn't already on the target.
  const existingUserCatNames = new Set(ctx.targetCategories.filter((c) => !c.global).map((c) => c.name));
  const userCategories = doc.userCategories.filter((c) => !existingUserCatNames.has(c.name));

  // Existing onset → cycle id, so re-imports merge instead of duplicating.
  const onsetToCycleId = new Map<string, string>();
  for (const c of ctx.existingCycles) {
    const onset = cycleOnset(
      ctx.existingDays.filter((d) => d.cycleId === c.id),
      ctx.existingPeriodDayIds,
    );
    if (onset) onsetToCycleId.set(format(onset, ISO_DATE), c.id);
  }

  // Dates already present anywhere (grows as we plan, so a backup can't add the
  // same date twice across cycles either).
  const seenDates = new Set(
    ctx.existingDays.filter((d) => d.date).map((d) => format(d.date as Date, ISO_DATE)),
  );

  const counts: ImportCounts = {
    cyclesToCreate: 0,
    daysToCreate: 0,
    daysSkipped: 0,
    factorsToCreate: 0,
    factorsUnresolved: 0,
  };

  const cycles: PlannedCycle[] = [];
  for (const bc of doc.cycles) {
    const days: PlannedDay[] = [];
    for (const bd of bc.days) {
      if (seenDates.has(bd.date)) {
        counts.daysSkipped += 1;
        continue;
      }
      seenDates.add(bd.date);
      const factors: PlannedFactor[] = [];
      for (const bf of bd.factors) {
        if (bf.ref.scope === 'user') {
          factors.push({
            level: { kind: 'user', categoryLocalId: bf.ref.categoryLocalId, levelLocalId: bf.ref.levelLocalId },
            notes: bf.notes,
            value: bf.value,
          });
        } else {
          const id = resolveGlobal(bf.ref);
          if (id) {
            factors.push({ level: { kind: 'global', categoryLevelId: id }, notes: bf.notes, value: bf.value });
          } else {
            counts.factorsUnresolved += 1;
          }
        }
      }
      counts.factorsToCreate += factors.length;
      days.push({ date: bd.date, order: bd.order, notes: bd.notes, factors });
    }

    if (days.length === 0) continue; // nothing new in this cycle

    const onset = backupCycleOnset(bc);
    const existingCycleId = onset ? (onsetToCycleId.get(onset) ?? null) : null;
    if (!existingCycleId) counts.cyclesToCreate += 1;
    counts.daysToCreate += days.length;
    cycles.push({ existingCycleId, createdAt: bc.createdAt, days });
  }

  return {
    userCategories,
    cycles,
    restoreDisplayName: ctx.existingDisplayName === '' && doc.displayName !== '',
    restoreSettings: ctx.existingSettings === null,
    counts,
  };
}
