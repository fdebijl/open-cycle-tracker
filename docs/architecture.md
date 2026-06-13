# Open Cycle Tracker — Architecture

Orientation doc for future architectural decisions. Covers the React client (`ui/`),
the Node API (`api/`), and the end-to-end-encryption model that ties them
together. For the canonical crypto spec see [`encryption.md`](./encryption.md);
for the API rewrite rationale see [`api_rewrite_plan.md`](./api_rewrite_plan.md).

## 1. What this is, and the threat model

A self-hosted menstrual cycle tracker. The project was prompted by the Roe v.
Wade repeal: the adversary may **seize the server and/or the user's device** and
may **legally compel the operator**. Therefore:

> **The server, and the operator, must be cryptographically unable to read user
> data.** All sensitive content is end-to-end encrypted with a key the server
> never sees. The API is a near-dumb ciphertext + metadata store; all crypto
> lives in the client.

This single requirement explains almost every design decision below.

## 2. Repo layout

```
open-cycle-tracker/
  api/    Node + TypeScript + Express + Drizzle (Postgres). The ciphertext store.
  ui/     React + TypeScript + Vite SPA. Where all crypto happens. (THIS app.)
  docs/  this file, encryption.md (the contract), api_rewrite_plan.md
```

The UI was a full rewrite from Ember; the Ember app has been removed and the
React app now lives at `ui/` root. The API was rewritten from Rails.

## 3. Encryption model (the crux)

Full spec in [`encryption.md`](./encryption.md). Summary:

**Primitives** (libsodium): Argon2id KDF (`crypto_pwhash`), XChaCha20-Poly1305
AEAD. Every encrypted value is a blob `nonce(24) || ciphertext+tag`, transported
as standard padded base64, stored as Postgres `bytea`.

**Keys**
- **DEK** (32 bytes) — encrypts all user content. Generated once at signup, held
  **in memory only**, never persisted, never sent to the server.
- **KEK** = `Argon2id(password, saltKek)` — wraps the DEK (`wrappedDek`).
- **recoveryKEK** = `Argon2id(recoveryCode, saltRecovery)` — wraps a second copy
  (`wrappedDekRecovery`) for forgotten-password recovery.
- **authHash** = `Argon2id(password, saltAuth)` — login *verifier*, not a key.
  Server stores `argon2id(authHash)` (double-hashed).
- **recoveryAuthHash** = `Argon2id(recoveryCode, saltRecoveryAuth)` — recovery
  verifier (mirrors authHash). Gates the recovery-commit endpoint so only a
  holder of the recovery code can overwrite key material. *(Added in this
  project; the original spec lacked it.)*

**Flows** (all key derivation is client-side):
- **Signup** — generate DEK + salts + recovery code; wrap DEK under KEK and
  recoveryKEK; derive authHash + recoveryAuthHash; POST the envelope.
- **Login** — `prelogin` returns `saltAuth` (+ a deterministic pseudo-salt for
  unknown identifiers, anti-enumeration); client derives authHash; `login`
  verifies and returns `saltKek` + `wrappedDek`; client derives KEK, unwraps DEK.
- **Password change** — re-wrap the in-memory DEK under a new password; the data
  and the recovery wrapping are untouched.
- **Recovery** — `recover/init` returns recovery material (anti-enumeration for
  unknown ids); client unwraps DEK with the recovery code, re-wraps under a new
  password, proves the recovery code via `recoveryAuthHash`, commits.

**What stays plaintext (accepted leakage):** UUID keys, `created_at`/`updated_at`,
a day's `order`, and global (system) categories. Consequently the server cannot
filter by content — see §6.

## 4. UI architecture (`ui/`)

### Stack
Vite + React + TypeScript, **SPA only** (no SSR — SSR would put keys/plaintext
on a server). React Router, TanStack Query (server state), Zustand (in-memory
vault). `libsodium-wrappers-sumo`, `@scure/bip39`, `date-fns`, `@mdi/react`.
Styling: CSS Modules (`.module.scss`). Tests: Vitest.

### Directory map (`ui/src/`)
```
crypto/    The E2EE implementation (see below).
api/       client.ts (fetch wrapper), auth.ts, resources.ts, types.ts (DTOs).
data/      mappers.ts (decrypt boundary), hooks.ts (TanStack), types.ts (domain).
auth/      session.ts — register/login/unlock/recover/changePassword/delete.
stores/    vault.ts — in-memory DEK + token, auto-lock.
hooks/     useResponsive.ts.
routes/    AppRoutes.tsx + screens (auth/, cycle/, tracking/, Calendar, Info, Settings, Unlock).
components/  NavBar, AppLayout, Field, Spinner, MdiIcon, EmergencyDelete,
             cycle/(CycleCircle, DayMarker, useProximityScaler), category/(CategoryRow).
config/    env.ts (VITE_API_URL, AUTO_LOCK_MS).
```

### Crypto layer (`src/crypto/`)
- `sodium.ts` — lazy-init the libsodium **sumo** build. **Must use sumo**: the
  standard `libsodium-wrappers` omits `crypto_pwhash` (Argon2id).
- `primitives.ts` — pure `deriveKeyRaw` (Argon2id), `aeadEncrypt/Decrypt`, RNG,
  KDF presets (`moderateKdfParams` for prod, `interactiveKdfParams` for tests).
- `worker.ts` + `kdf.ts` — Argon2id is slow/memory-hard, so `kdf.deriveKey` runs
  it in a **Web Worker**; everything calls `kdf.deriveKey`, never `deriveKeyRaw`
  directly. Falls back to inline derivation when `Worker` is undefined (Node/tests).
- `envelope.ts` — `createSignup`, `deriveAuthHash`, `unwrapDek`, `recoverDek`,
  `deriveRecoveryAuthHash`, `mnemonicToRecoveryCode`, `rewrapForPasswordChange`.
- `fields.ts` — `encryptString`/`decryptString` (+ JSON variants) for the data layer.
- `codec.ts` — base64 + BIP39 mnemonic encode/decode.
- `index.ts` — barrel.

### Vault & key hygiene (`src/stores/vault.ts`)
The DEK lives **only in this Zustand store, in memory** — never
localStorage/IndexedDB. State: `session` (token + user + wrapping material) and
`dek`. A full reload wipes everything → re-login each launch. **Auto-lock**
(`installAutoLock`, called once from `AppRoutes`) wipes just the DEK on
inactivity (`AUTO_LOCK_MS`) and on tab-hidden (`visibilitychange`), keeping the
non-secret wrapping material so the user can re-unlock with their password alone
(no network round-trip).

### API client (`src/api/`)
- `client.ts` — typed `fetch` wrapper. Injects `Authorization: Bearer <token>`,
  parses the `{ error: { code, message, details } }` envelope into `ApiError`,
  and on a 401 *with* a session triggers `vault.logout()` (so a dead token falls
  back to login; a 401 from `/auth/login` does not spuriously log out).
- `auth.ts` — prelogin/signup/login/logout/changePassword/recoverInit/recover.
- `resources.ts` — cycles/days/factors/categories/categoryLevels/users.
- `types.ts` — DTOs; encrypted fields are base64 strings.

### Data layer (`src/data/`) — the decrypt/encrypt boundary
- `mappers.ts` — converts DTOs ⇄ decrypted domain models using the DEK. This is
  the only place plaintext content is produced. Handles the global-vs-user
  category two-tier (prefer `enc*` when present, else plaintext globals).
- `hooks.ts` — TanStack Query hooks. Queries fetch DTOs then decrypt; keyed by
  user id, gated on `dek` present. Mutations encrypt then POST/PATCH and
  invalidate. Includes `useCreateCycleWithDays` (the Ember `populateDays`
  equivalent: cycle + 28 encrypted days).
- `types.ts` — `Day`, `Cycle`, `Factor`, `Category`, `CategoryLevel`, `DayType`.

### Auth/session orchestration (`src/auth/session.ts`)
Composes crypto + API + vault so screens stay thin: `registerAccount`,
`loginAccount`, `unlockWithPassword`, `recoverAccount`, `changePassword`,
`logoutAccount`, `deleteAccount`.

### Routing (`src/routes/AppRoutes.tsx`)
Guards: `RequireUnlocked` (needs session **and** DEK → else `/unlock` or
`/login`), `RequireSession` (the unlock screen), `PublicOnly` (auth screens).
Routes: `/login /register /recover /unlock` (public) and, under `AppLayout`:
`/` (current cycle), `/cycles/:id`, `/days/:id`, `/today` (resolver), `/calendar`,
`/info`, `/settings`.

### Notable components
- `cycle/CycleCircle` + `DayMarker` + `useProximityScaler` — days positioned
  evenly on a circle; the proximity scaler ports the Ember `child-proximity-scaler`
  modifier by mutating marker DOM directly on `pointermove` (no per-frame React
  re-render). Day color encodes `dayType`.
- `MdiIcon` — renders MDI icons by name via a **curated registry** (importing all
  of `@mdi/js` is ~1.3 MB and not tree-shakeable). Unknown names fall back to a
  help icon.
- `EmergencyDelete` — hold-to-confirm destructive button.

## 5. API surface (`api/`) — brief

Plain JSON. All resource routes require `Authorization: Bearer`. Bodies carry
`bytea` as base64.
- **Auth:** `POST /auth/prelogin|signup|login`, `DELETE /auth/logout`,
  `POST /auth/password` (authed change), `POST /auth/recover/init`, `POST /auth/recover`.
- **Resources:** `users` (get/patch/delete self), `cycles`, `days`, `factors`,
  `categories`, `category_levels` (note underscore) — index/show/create/patch/delete,
  with only `?filter[id]=uuid,uuid` filtering.
- DB: Drizzle on Postgres; sensitive columns are `bytea`. Schema in
  `api/src/db/schema.ts`; reference client crypto in `api/src/crypto-client/`.

## 6. Invariants & gotchas (read before changing things)

- **DEK is memory-only.** Never persist it. Never add a "remember me" that stores it.
- **Use `libsodium-wrappers-sumo`**, not `libsodium-wrappers` (Argon2id).
- **`@mdi/react@1.x` is CJS** — import the component as a **named** export
  (`import { Icon } from '@mdi/react'`); the default import resolves to the
  module namespace object under Vite and throws "Element type is invalid".
- **Recovery code encoding:** the user sees a BIP39 mnemonic, but the KDF input
  is the **base64 string** of the 32 secret bytes — this matches the API's
  reference `crypto-client`, keeping the two implementations interoperable. Don't
  change one side without the other.
- **No server-side content filters.** "Current cycle" (newest by `createdAt`),
  "today", and per-cycle day grouping are all derived **client-side after
  decryption**. The API only filters by `id`.
- **Model shift from Ember:** a `Factor` now references a `categoryLevelId`
  (+ encrypted notes) rather than a category + level string. Day date/type and
  user name/info/settings are encrypted blobs.
- **DB connection (local dev):** `api/.env`'s `DATABASE_URL` must use the unix
  socket for peer auth — `postgres://USER@localhost/oct_dev?host=/var/run/postgresql`.
  The TCP form (`@localhost:5432`) triggers SCRAM and fails with "client password
  must be a string" unless a password is set. `.env.example` ships the TCP form.
- **Two databases:** `oct_dev` (manual/dev) and `oct_test` (Vitest, set in
  `api/vitest.config.ts`). Both need migrations applied (`pnpm db:migrate` with
  the right `DATABASE_URL`); re-seed globals with `pnpm db:seed`.
- **Auth secrets** (`JWT_SECRET`, `SERVER_SECRET`) are `change-me-…` placeholders
  in `.env` — fine for local, must be real before deployment.

## 7. Commands

```bash
# UI (ui/)
pnpm dev      # http://localhost:5173 (must be in api's CORS_ORIGINS)
pnpm test     # Vitest: crypto envelope round-trip + no-plaintext + mappers
pnpm build    # tsc -b && vite build

# API (api/)
pnpm dev          # http://localhost:3000
pnpm test         # Vitest + Supertest (uses oct_test)
pnpm db:migrate   # apply migrations
pnpm db:seed      # seed global categories
```

**Security acceptance test:** after a signup, inspect Postgres and confirm
`auth_hash` is an `$argon2id$…` hash and `enc_*` / `wrapped_dek*` columns are
opaque `bytea` with no readable date/notes/day-type/password anywhere.

## 8. Status

Rewrite complete: auth (register w/ recovery phrase, login, unlock, logout,
password change, recovery), cycle tracker (circle, day editor), calendar, info,
settings (incl. hold-to-delete). API has the full password-reset flow. Both test
suites pass. Not yet done: real auth secrets, CI for the new stack, and any
deploy/TCP-Postgres configuration.
