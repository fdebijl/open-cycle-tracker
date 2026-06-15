# Duress Passwords (roadmap #14) — Feasibility & Build Plan

## Context

Roadmap #14 asks for two extra passwords on an account:

1. **Destruction password** — entering it destroys all data.
2. **Duress password** — unlocks a "duress mode" that looks normal but exposes no
   sensitive data.

**Threat model (clarified with the user):** a *lower-tier, unsophisticated*
adversary doing a cursory look — an abusive/controlling partner, a nosy friend,
or a border agent glancing at the app. Not someone who will open browser
devtools, replay the JWT against the API, or seize and inspect the server DB.

A key product requirement shaped the design: the user wants to **log into the
decoy at will** (not only under coercion) to populate it with mundane/decoy logs
so it looks lived-in — e.g. to stop an abusive partner from learning about real
reproductive/cycle events.

That requirement **rules out UI-only masking**: masking just hides the single
real dataset, and there is no second dataset to populate. It forces a **real
second vault** — which is also the more secure option and is comfortably
sufficient against the stated threat model.

**Feasibility verdict: yes, and the existing crypto protocol is unusually
well-suited to it.** Two existing facts make it nearly drop-in:

- `prelogin` returns a single `saltAuth` per identifier, so the client derives
  *one* `authHash` regardless of which password was typed
  (`ui/src/crypto/envelope.ts:86`, `deriveAuthHash`). Extra passwords become
  extra **server-side verifiers**; the client login path does not change and
  `prelogin` leaks nothing about how many passwords exist.
- The login response hands the client `saltKek` + `wrappedDek`, and the client
  blindly unwraps whatever key material it is given (`unwrapDek`,
  `envelope.ts:92`). The server can therefore return **a different vault's key
  material** per password and the client "just works".
- Every tracking query is already scoped by `ctx.userId` (verified in
  `cycles/days/factors` services — e.g. `eq(cycles.userId, ctx.userId)`), and
  `ctx.userId` comes from the JWT `sub`. So a decoy session that is simply a
  **different `userId`** is fully isolated for free.

## Recommended architecture: decoy vault = a second (shadow) user row

The decoy vault is modelled as a **separate `users` row** ("shadow user") that
owns its own `cycles`/`days`/`factors`/settings. The primary user row links to it
and holds the duress + destruct **verifiers**.

```
users (primary)                          users (shadow / decoy)
  id, identifier, authHash (real)          id (random identifier, never typed)
  saltAuth, saltKek, wrappedDek            saltKek = saltKekDuress
  ...                                      wrappedDek = wrappedDekDuress (decoy DEK)
  + duressUserId  ───────────────────────► owns decoy cycles/days/factors via userId
  + duressAuthHash   (verifier, decoy)     encSettings = decoy settings
  + destructAuthHash (verifier, wipe)
```

**Login branching** (`api/src/modules/auth/service.ts:96`, `login()`): load the
**primary** by identifier, then compare the incoming `authHash` against, in order:

- `authHash` (real) → return `authResultFor(primary)` (today's behaviour).
- `duressAuthHash` → return `authResultFor(shadow)` — token `sub` = shadow id, plus
  the shadow's `saltKek`/`wrappedDek`. Client unwraps the decoy DEK and renders
  the decoy vault normally.
- `destructAuthHash` → **wipe** primary + shadow, then throw the **same**
  `unauthorized('Invalid credentials')` as a wrong password (silent wipe).

To keep timing uniform and avoid leaking which verifier matched, run a **fixed
number of argon2 verifications** (don't short-circuit), mirroring the existing
`DUMMY_ARGON` pattern.

### Why this approach (and what was considered)

- **Shadow user row (chosen):** zero changes to tracking-domain queries; isolation
  is the `userId` scoping that already exists and is already tested, so there's no
  "forgot to filter the decoy" leak class. Decoy is real, persistent, editable —
  meets "log in at will to maintain it".
- **`realm` discriminator column on every data table (considered, rejected):**
  one user row + a `realm: real|decoy` column + a JWT `realm` claim + filtering on
  every read/write + a decoy `encSettings` variant. Far more invasive across the
  data layer and a new leak class if any query forgets the filter.
- **UI-only masking (considered, rejected):** cannot hold a separate decoy
  dataset, so it fails the core requirement; also insecure beyond a glance (real
  DEK + ciphertext reachable via devtools/API). The user explicitly accepted this
  trade-off only as a fallback, which the requirement removes.

### Destruction password UX

Chosen: **silent wipe + generic "Invalid credentials"** — the wipe runs
server-side and the attacker sees exactly what a wrong password shows, so a
coerced user can plausibly claim they misremembered. *Considered:* wipe + log into
an empty account (less suspicious in the moment, but signals the password
"worked" and invites probing) — not chosen.

## Changes by area

### 1. Schema / migration (`api/src/db/schema.ts` + new `drizzle/0005_*.sql`)

Add to `users` (all nullable — unconfigured accounts leave them null):

- `duressUserId uuid` → FK to `users.id` (self-reference; the shadow row).
- `duressAuthHash text` — `argon2id(client duress verifier)`, double-hashed like
  `authHash` via `hashAuthHash` (`api/src/lib/password.ts`).
- `destructAuthHash text` — same treatment, for the destruction password.

The shadow row is an ordinary `users` row (reuse all existing columns); its own
`authHash`/`recoveryAuthHash`/salts can be valid-but-unused filler since login
always looks up the **primary** by identifier and never the shadow's identifier.
Give the shadow a **random, unguessable `identifier`** (not derived from the real
one).

### 2. Server: setup endpoint + login + destruct

- **New authenticated endpoint** (`api/src/modules/auth/`), e.g.
  `POST /auth/duress` (and a `DELETE` to disable): callable only by an unlocked
  real session. Accepts the decoy envelope the client built (see §3) and the
  duress/destruct verifiers; creates the shadow `users` row and sets
  `duressUserId`/`duressAuthHash`/`destructAuthHash` on the primary. Reuse the
  insert shape from `signup()`.
- **`login()`** (`service.ts:96`): implement the three-way verifier branch above.
  Keep the constant-work / generic-error discipline.
- **Destruct wipe:** delete both primary and shadow rows (cascades clear all
  data). The `duressUserId` FK does **not** auto-cascade primary→shadow, so delete
  the shadow explicitly (or model the delete to cover both). Reuse the cascade in
  `users/service.ts:46` (`deleteUser`).
- **Schemas** (`auth/schema.ts`): add Zod bodies for the new endpoint. No change to
  `prelogin`/`login` request/response shapes (anti-enumeration preserved).

### 3. Client crypto (`ui/src/crypto/envelope.ts`)

- `createDecoyVault(duressPassword, primarySaltAuth, kdfParams)` → builds a fresh
  decoy DEK, wraps it under a new `saltKekDuress` (reuse `randomBytes`,
  `deriveKey`, `aeadEncrypt`), and derives `duressAuthHash` from
  **`primarySaltAuth`** (so the server can match it on login). Returns the decoy
  envelope (`saltKek`, `wrappedDek`, verifier) for the shadow row.
- Destruct password needs **only a verifier** — reuse existing
  `deriveAuthHash(destructPassword, primarySaltAuth, params)`.
- **Login path is unchanged** — `prelogin → deriveAuthHash → login → unwrapDek`
  already handles real, decoy (shadow returns its own key material), and destruct
  (server returns 401 → existing "invalid credentials" UI).

### 4. Client UI (`ui/src/routes/Settings.tsx` + new component)

- A **"Decoy & duress" section** in Settings (only reachable from the real vault):
  set/change/disable the duress password, set/clear the destruct password, with
  strong copy explaining destruct is **irreversible** and the decoy is a separate
  vault to be populated by logging in with the duress password.
- **No visible "you are in decoy mode" indicator** anywhere — a watcher must not be
  able to tell. The user knows which vault they're in by which password they used.
  (Optional future: a hidden gesture to confirm; out of scope.)
- The decoy vault reuses the **entire existing app + onboarding** unchanged (it's
  just another session), so populating decoy cycles/days/symptoms needs no new
  screens.

### 5. Interactions to handle

- **Recovery:** the recovery code recovers the **real** vault only (today's flow,
  untouched). The decoy is managed from inside the real vault's settings; it is not
  independently recoverable (acceptable — note it in copy).
- **Password change:** changing the real password rotates `saltAuth`, which would
  invalidate `duressAuthHash`/`destructAuthHash` (both derived from `saltAuth`).
  `changePassword` (`service.ts:122`) must **re-derive and update** those verifiers
  too — the client already holds the duress/destruct passwords only at setup time,
  so either (a) require re-entering them on real-password change, or (b) store the
  verifiers under an independent salt that survives rotation. **Decision needed at
  build time** — recommend (b): give duress/destruct their own fixed salt so a
  real-password change leaves them intact.

## Security caveats (document these; in-scope failures are acceptable)

- **Protects against the stated threat only.** Anyone who can read the **server
  DB** sees the shadow row, the `duressUserId` link, and that
  `duress/destructAuthHash` are populated → learns a decoy exists. Deniability
  against DB seizure is **not** a goal here. (Future hardening: random filler in
  the verifier columns when unconfigured; obscure the primary↔shadow link.)
- **Destruct is irreversible and a foot-gun** without an export/restore path
  (roadmap #5). Recommend gating prominent destruct UX on #5, or at minimum very
  explicit confirmation copy.
- A DB-snapshot-before-coerced-login defeats destruct; can't be prevented
  client-side. Note it.

## Implementation order

1. Migration + `schema.ts` columns (§1).
2. Client `createDecoyVault` + envelope unit tests (§3) — pure, fast to TDD.
3. Server setup endpoint + Zod schemas + shadow-row creation (§2).
4. Server `login()` three-way branch + destruct wipe, with timing-uniform
   verification (§2). Re-derive duress/destruct verifiers in `changePassword` (§5).
5. Settings UI for setup/change/disable (§4).

## Verification

- **Unit (crypto):** `createDecoyVault` round-trips — the decoy DEK unwraps with
  the duress password and **fails** with the real password; duress/destruct
  verifiers match server-side.
- **API integration:** with a configured account, `POST /auth/login` returns
  (a) the primary session for the real password, (b) a shadow-`sub` session for
  the duress password, (c) `401` for the destruct password **and** the account +
  shadow rows are gone afterward. Confirm a decoy session sees only decoy
  `cycles/days/factors` (isolation via existing `userId` scoping).
- **E2E (use the `run` skill / browser):** set up a decoy in Settings; log out;
  log in with the duress password and confirm a clean, separate vault that
  persists edits across logins; log in with the real password and confirm real
  data is intact and the decoy is invisible; confirm no UI tells you which vault
  you're in. Finally, log in with the destruct password and confirm a generic
  failure plus that the account is wiped.
- **Regression:** existing auth tests (signup/login/recover/change) still pass and
  `prelogin`/`login` wire formats are unchanged.
