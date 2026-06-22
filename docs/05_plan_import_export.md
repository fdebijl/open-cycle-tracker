# Plan #5 — Data export / backup & restore

## Context

The threat model treats the server as untrusted and seizable, and the DEK lives
only in memory. Until now there was account *deletion* but no way to get
tracking data **out**: if the operator's server disappeared the user's only copy
was gone, and there was no device-migration or restore path. Roadmap gap #5
called this "a real hole … deserves a deliberate design decision."

This shipped **export** (download the whole dataset) and **import** (restore it
into a logged-in account, including a fresh self-hosted instance).

Two product decisions, settled with the user:

1. **Protection is a per-export choice, encrypted by default.** The default is a
   self-contained **encrypted backup unlocked by the existing recovery phrase**.
   Encryption is keyed to the recovery phrase, *not* the password, so it survives
   a lost password (the original motivation for export) and a vanished server,
   while staying protected at rest. A **plaintext JSON** export is an explicit,
   warned opt-in for portability / ultimate escape-hatch.
2. **Import merges into the current account**, de-duplicating by date, so
   re-importing is safe and migrating into a fresh instance is just "sign up
   there, then import."

**The feature is entirely client-side — no API or DB changes.** Export decrypts
with the in-memory DEK and, for the encrypted file, bundles recovery-wrapping
material already served by `POST /auth/recover/init`. Import re-creates records
through the existing CRUD endpoints, re-encrypting under the current DEK.

## Crypto reuse

- **Encrypted export** needs `saltRecovery`, `wrappedDekRecovery`, `kdfParams` —
  returned by `recoverInit(identifier)` (`ui/src/api/auth.ts`), and the export
  client knows its own `session.user.identifier`. The payload is sealed with the
  in-memory DEK (`aeadEncrypt`); because the bundled `wrappedDekRecovery` wraps
  that same DEK, the user's real recovery phrase opens the file — no secret entry
  at export time, no typo risk.
- **Restore of an encrypted file** prompts for the 24-word phrase, then
  `mnemonicToRecoveryCode` > `recoverDek(...)` > file DEK > `aeadDecrypt`. A wrong
  phrase fails AEAD auth and surfaces a friendly error. All from
  `ui/src/crypto/envelope.ts`.

## File format (both are `.json` text)

Encrypted envelope:
```jsonc
{ "format": "oct-backup", "encrypted": true, "schema": 1,
  "kdf": <KdfParams>, "saltRecovery": "<b64>", "wrappedDekRecovery": "<b64>",
  "payload": "<b64 of aeadEncrypt(JSON(BackupDocument), dek)>" }
```
Plaintext envelope:
```jsonc
{ "format": "oct-backup", "encrypted": false, "schema": 1, "document": <BackupDocument> }
```
`BackupDocument` holds `exportedAt`, `app`, `displayName`, `settings`,
`userCategories[]`, and `cycles[]` > `days[]` > `factors[]`. Each factor records
a `CategoryLevelRef` rather than a raw UUID, because global-category UUIDs differ
per instance:
- global: `{ scope: 'global', categorySlug?, categoryName, levelName, levelOrder }`
  — re-resolved on the target by slug|name + level name|order.
- user: `{ scope: 'user', categoryLocalId, levelLocalId }` — indexes into the
  document's `userCategories`, remapped to ids minted when those categories are
  re-created on import.

## Where it lives

- `ui/src/data/backup.ts` — **pure** core (no React/API/`Date.now`), unit-tested
  like `prediction.ts`/`cycles.ts`: `buildBackupDocument`, `encodePlaintextFile`,
  `encodeEncryptedFile`, `parseBackupFile` (validates `format`/`schema`),
  `decryptEncryptedFile`, and `planImport` (global remap + date dedup + cycle
  identity-by-onset + never-clobber name/settings). Returns count summaries.
- `ui/src/data/backup.hooks.ts` — `useExportBackup` / `useImportBackup`: the I/O
  around the core (gather + decrypt, `recoverInit`, Blob download; parse +
  decrypt + sequential re-create via existing wrappers; query invalidation).
- `ui/src/api/resources.ts` — added `categoriesApi.create` /
  `categoryLevelsApi.create` (routes already existed) for restoring user
  categories.
- `ui/src/routes/settings/DataSettings.tsx` — a new **Data** settings tab
  (wired in `SettingsLayout.tsx` + `AppRoutes.tsx`) with export (format choice +
  plaintext warning) and import (file picker, conditional recovery-phrase field,
  result summary).
- `ui/src/i18n/locales/en/translation.json` — `settings.data.*` namespace.
- `ui/src/data/backup.test.ts` — round-trips (plaintext + encrypted),
  wrong-phrase rejection, schema/format guards, and `planImport` remap / dedup /
  cycle-merge / no-clobber.

## Known limitations

- Fertile/ovulation aren't persisted, so they aren't in the backup (they're a
  recomputed forecast) — correct, not a gap.
- Cross-instance factor resolution relies on stable global slugs/names; if the
  global seed is renamed, old backups' unmatched factors are dropped (and
  counted in the import summary), not silently mis-assigned.
- User-defined category levels lose their ordinal `order` on restore (the create
  endpoint is `.strict()` and doesn't accept it). Moot today — no UI creates
  custom categories — but worth lifting if/when custom categories ship.

## Verification

1. `cd ui && npx vitest run` (85 passing) + `tsc -b` + `eslint .`.
2. Manual end-to-end: log cycles/days/factors (incl. a BBT value + note), set a
   display name + cycle length > export *Encrypted* > on a second fresh account,
   import with the first account's recovery phrase > data reappears intact.
   Re-import > all days reported skipped, nothing duplicated. Export/import the
   *Plaintext* path. A bad recovery phrase shows the friendly error with no
   partial writes.
