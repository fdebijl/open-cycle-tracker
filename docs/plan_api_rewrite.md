# Rewrite Open Cycle Tracker API: Rails → Node.js + TypeScript + Express (E2EE)

## Context

Open Cycle Tracker is a self-hosted menstrual cycle tracker. The existing implementation is an early-stage Rails 7 API (~30% built, mostly scaffolding, placeholder tests). The owner isn't excited enough about Rails to finish it, so we're rewriting to a Node.js + TypeScript + Express stack.

**The rewrite is also a security redesign.** The project was prompted by the Roe v. Wade repeal; the adversary is a government that may **seize the hosting server and/or the user's personal device**, may legally compel the operator, and the user's device may lack full-disk encryption. The current Rails app stores all sensitive data (cycle dates, day types, symptom notes, user info/settings) as **plaintext** — unacceptable for this threat model.

The defining requirement: **the server, and the operator, must be cryptographically unable to read user data.** That mandates **end-to-end encryption with client-held keys** — server-side encryption fails because seizing the server (or compelling the operator) yields the key. The Express API therefore becomes a near-dumb **ciphertext + metadata store**; the real complexity (key lifecycle, encryption, client-side filtering, recovery) lives in the client.

### Decisions (settled with the owner)

| Area | Decision |
|---|---|
| Runtime/framework | Node.js + TypeScript + Express |
| ORM | **Drizzle** (drizzle-orm + drizzle-kit) on PostgreSQL |
| Auth | **Hand-rolled JWT** — argon2id auth-hash, jti denylist revocation, pseudonymous accounts (username; email optional) |
| Authorization | **Hand-rolled policy modules** + query-scoping helpers (mirrors Pundit) |
| API format | **Plain JSON** (drop JSON:API) |
| Validation / Testing | **Zod** + **Vitest** + **Supertest** |
| Encryption | **Field-level E2EE**, client-held keys. Server stores ciphertext blobs only. |
| Client | **Web (React) now, native later** — design a client-agnostic crypto contract; web client uses memory-only key hygiene |
| Metadata | **Strong but pragmatic** — optional email, no IP logging, encrypt notes/dates/day_type, leave row-level created_at/updated_at, client-side filtering, user-held recovery codes |
| Scope | **Parity + finish CRUD** — port all existing endpoints AND add the missing update/destroy + validation |
| Data | **Greenfield** — fresh DB, no migration (E2EE makes server-side migration impossible anyway) |

The existing Rails files are the **parity reference** for endpoints/domain: `app/controllers/`, `app/models/`, `app/policies/`, `app/serializers/`, `config/routes.rb`, `db/schema.rb`.

---

## The encryption contract (the heart of the rewrite)

This is a documented, client-agnostic spec (`docs/encryption.md` + shared TS types) so the React client now and a native client later implement it identically. The **server only stores and returns the values below — it never derives or holds any key.**

**Primitives** (client uses `libsodium-wrappers`):
- KDF: **Argon2id** (`crypto_pwhash`), params stored per-user (`kdfParams`: opslimit/memlimit) so they can be raised over time.
- AEAD: **XChaCha20-Poly1305** (`crypto_aead_xchacha20poly1305_ietf`) — random 192-bit nonce is safe to generate per encryption.

**Envelope (signup, all client-side):**
1. Generate random 256-bit **DEK** (Data Encryption Key) — encrypts all user data.
2. Derive **KEK** = Argon2id(password, `salt_kek`). Compute `wrappedDEK` = AEAD(DEK, key=KEK).
3. Derive **authHash** = Argon2id(password, `salt_auth`) — the value sent to the server for login (NOT a key).
4. Generate a one-time **recovery code** (shown once, BIP39-style). Derive recoveryKEK = Argon2id(recoveryCode, `salt_recovery`); compute `wrappedDEK_recovery` = AEAD(DEK, key=recoveryKEK).
5. Send to server: `identifier`, `email?`, `authHash`, `salt_auth`, `salt_kek`, `salt_recovery`, `kdfParams`, `wrappedDEK`, `wrappedDEK_recovery`. Server stores `argon2id(authHash)` (double-hashed) + the rest verbatim.

**Login:**
- `POST /auth/prelogin { identifier }` → `{ salt_auth, kdfParams }`. For unknown identifiers, return a **deterministic pseudo-salt** (`HMAC(serverSecret, identifier)`) to prevent user enumeration.
- Client derives authHash, then `POST /auth/login { identifier, authHash }` → verifies, returns `{ token, salt_kek, wrappedDEK, kdfParams }`. Client derives KEK, unwraps DEK **in memory only**.

**Field encryption:** each sensitive field value = AEAD(plaintext, key=DEK, random nonce), stored as `bytea` (`nonce || ciphertext || tag`). The server treats these as opaque.

**Password change:** re-derive KEK, re-wrap DEK (cheap; data untouched). **Recovery:** enter recovery code → unwrap DEK → set new password → re-wrap. **Server can never recover — by design, so it can't be compelled to.**

**Client (web) key hygiene:** DEK lives in memory only — never `localStorage`/`IndexedDB`; re-prompt for password on each launch; auto-lock + wipe key on background/timeout. (Web's ceiling vs. a powered-off seized device; native later raises it.)

---

## Server schema (Drizzle, `src/db/schema.ts`)

Greenfield Postgres. UUID PKs (`gen_random_uuid()`, `pgcrypto`). **Sensitive fields are `bytea` ciphertext; only UUIDs, relations, and coarse metadata stay plaintext.**

- **users**: `id`, `identifier` (text, unique — username), `email` (text, nullable — leave null by default; metadata risk noted), `auth_hash` (argon2 of client authHash), `salt_auth`, `salt_kek`, `salt_recovery`, `kdf_params` (jsonb), `wrapped_dek` (bytea), `wrapped_dek_recovery` (bytea), `is_admin` (bool), `created_at`, `updated_at`.
- **revoked_tokens** (jti denylist): `jti`, `expires_at` — for logout/revocation (replaces Devise JTIMatcher; supports multi-device).
- **cycles**: `id`, `user_id`, `created_at`, `updated_at`. (Grouping only — no sensitive fields; date range derives client-side from days.)
- **days**: `id`, `cycle_id`, `user_id`, `enc_date` (bytea), `enc_day_type` (bytea), `order` (int, plaintext — low sensitivity), timestamps. **Drop the unique index on `date`** (ciphertext is non-deterministic; uniqueness enforced client-side).
- **categories**: `id`, `user_id` (nullable), `global` (bool), timestamps. **Two-tier content**: global categories (system seed) keep plaintext `name`/`icon`/`color`; user categories store `enc_name`/`enc_icon`/`enc_color` (bytea) with the plaintext columns null. *(Design wrinkle — alternative is encrypting all and shipping globals as client constants.)*
- **category_levels**: `id`, `category_id`, timestamps. Same two-tier (`name`/`icon` plaintext for global, `enc_*` for user).
- **factors**: `id`, `day_id`, `user_id`, `category_level_id`, `enc_notes` (bytea), timestamps.

All FKs `ON DELETE CASCADE` (parity with current). `created_at`/`updated_at` stay plaintext per the metadata decision; the *meaningful* date (the tracked day) is encrypted in `enc_date`.

---

## API surface (plain JSON; parity + finished CRUD)

Mirror `config/routes.rb`, replacing the JSON:API envelope with flat JSON and the Devise endpoints with the custom auth flow. Request bodies carry `bytea` fields as base64.

- **Auth**: `POST /auth/prelogin`, `POST /auth/signup`, `POST /auth/login`, `DELETE /auth/logout` (revoke jti).
- **Users**: `GET /users/:id`, `PATCH /users/:id` (self only). No listing.
- **Cycles / Days / Categories / CategoryLevels / Factors**: `GET /` (index), `GET /:id`, `POST /`, **`PATCH /:id`, `DELETE /:id`** (newly added), and `GET /?filter[id]=…`. **Drop server-side content filters** that need plaintext (`filter[today]`, `filter[current]`, date ranges) — the client fetches its rows and filters after decryption. Keep `filter[id]` (UUIDs are plaintext).

**Validation (Zod):** validate structural/metadata fields server-side (UUIDs, relations, `order`, base64 well-formedness, ciphertext length bounds). Content correctness (e.g., `day_type` in the allowed set) moves to the client since it's ciphertext.

---

## Authorization (hand-rolled policy modules)

Mirror `app/policies/`. A `requireAuth` middleware verifies the JWT (checks `revoked_tokens`), attaches `req.user`. Per-resource policies + a scoping helper:
- Default: `record.user_id === req.user.id` for read/write; index/show/filter scoped via a `scopedTo(userId)` query helper.
- **Users**: self only (`record.id === req.user.id`).
- **Categories / CategoryLevels**: readable if owned **or** `global`; writable if owned **or** (`is_admin` && `global`). Scope = `user_id = me OR global = true` (levels join through category). Matches `CategoryPolicy`/`CategoryLevelPolicy`.

---

## Cross-cutting / security middleware

- **CORS**: replace the current `origins '*'` with an env-driven allowlist (`helmet` + `cors`).
- **Rate limiting**: add `express-rate-limit` (the Rails app had none) — strict on `/auth/login`, `/auth/prelogin`, `/auth/signup` to blunt brute force.
- **Logging**: `pino` configured to **not log IPs or request bodies** (metadata decision). `trust proxy` set carefully.
- **Config**: Zod-validated env (`JWT_SECRET`, `DATABASE_URL`, `SERVER_SECRET` for prelogin HMAC, `CORS_ORIGINS`, argon2 cost). No secrets in source.
- **Password hashing (server side)**: `@node-rs/argon2` (native) or `argon2` for hashing the client `authHash`.

---

## Project structure

```
src/
  index.ts            app bootstrap / listen
  app.ts              express app + middleware wiring
  config/             zod-validated env
  db/ schema.ts, index.ts (drizzle client), migrate.ts
  middleware/         auth.ts, error.ts, rateLimit.ts
  lib/                jwt.ts, password.ts (argon2), responses.ts
  policies/           ownership.ts (scope helper), category.policy.ts, …
  modules/<resource>/ routes.ts, service.ts, schema.ts (zod)  ← auth, users, cycles, days, categories, categoryLevels, factors
docs/encryption.md    the client-agnostic crypto contract
drizzle/              generated migrations
test/                 vitest + supertest
```

---

## Build order

1. Scaffold: TS + Express + tsx/build, ESLint/Prettier, Vitest, Drizzle + Postgres, env config, error/response helpers.
2. Schema + migrations (drizzle-kit), seed global categories.
3. `docs/encryption.md` + shared crypto types; server-side argon2/JWT/jti helpers.
4. Auth module (prelogin/signup/login/logout) + `requireAuth`.
5. Policies + scoping helper.
6. Resource modules (users, cycles, days, categories, categoryLevels, factors) with Zod schemas, full CRUD, plain-JSON responses.
7. Security middleware (CORS allowlist, rate limit, helmet, pino-no-PII).
8. Tests + README.

---

## Verification

- **Unit (Vitest):** envelope round-trip in the shared crypto lib (derive → wrap → unwrap → encrypt → decrypt; assert server payload contains no plaintext); argon2 auth-hash verify; jwt + jti revocation; policy ownership (owner allowed, non-owner 403, global category read).
- **Request (Supertest):** pseudonymous signup (no email), prelogin user-enumeration resistance (consistent salt for unknown identifier), login → token, CRUD on cycles/days/factors with base64 ciphertext blobs, cross-user access → 403, rate-limit triggers on repeated bad logins.
- **Manual:** `docker` Postgres → `drizzle-kit migrate` → start server → `curl` signup/login/create-day → **inspect Postgres with `psql` and confirm `enc_*` columns are opaque `bytea` and no plaintext date/notes/day_type exist anywhere.** This last check is the acceptance test for the whole security premise.

## Out of scope (flag for later)
Native client; client-driven data migration; advanced device-side defenses (duress/decoy, plausible deniability); full email-less account recovery beyond recovery codes; defense against a *live-surveilled/compromised* endpoint (unsolvable at the app layer — document the boundary so the project doesn't over-promise).
