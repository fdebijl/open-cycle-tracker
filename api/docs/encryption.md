# Encryption contract

This document is the **client-agnostic specification** for Open Cycle Tracker's
end-to-end encryption. Any client (the React web app now, a native app later)
MUST implement it identically. The server implements **none** of it - it stores
opaque ciphertext and the public key-derivation inputs, and can decrypt nothing.

> Threat model (see `docs/REWRITE_PLAN.md`): an adversary may seize the server
> and/or the user's device and may legally compel the operator. Therefore the
> decryption keys exist **only on the client**, derived from a password the
> server never receives.

## Primitives

| Purpose                  | Algorithm                 | libsodium call                         |
| ------------------------ | ------------------------- | -------------------------------------- |
| Key derivation (KDF)     | Argon2id                  | `crypto_pwhash` (`ALG_ARGON2ID13`)     |
| Authenticated encryption | XChaCha20-Poly1305 (IETF) | `crypto_aead_xchacha20poly1305_ietf_*` |
| Randomness               | CSPRNG                    | `randombytes_buf`                      |

- **Salt** length: 16 bytes (`crypto_pwhash_SALTBYTES`).
- **Nonce** length: 24 bytes (`crypto_aead_xchacha20poly1305_ietf_NPUBBYTES`). A
  random nonce per encryption is safe at this size.
- **Key** length: 32 bytes (DEK, KEK, recovery KEK, authHash).

### Blob format

Every encrypted value is serialized as:

```
blob = nonce (24 bytes) || ciphertext-with-tag
```

and transported as **base64** (standard, padded) in JSON, or stored as Postgres
`bytea`. Decryption splits the first 24 bytes off as the nonce.

### KDF parameters (`kdfParams`)

Stored per-user and returned to the client so they can be raised over time
without breaking existing accounts:

```jsonc
{ "algorithm": "argon2id", "opsLimit": <int>, "memLimit": <int> }
```

Clients SHOULD use at least `MODERATE` limits in production. Test fixtures use
`INTERACTIVE` for speed.

## Keys

- **DEK** (Data Encryption Key): random 32 bytes, generated once at signup.
  Encrypts every user-content field. Never leaves the client unencrypted.
- **KEK** (Key Encryption Key): `Argon2id(password, saltKek, kdfParams)`.
  Wraps the DEK. Never sent to the server.
- **Recovery KEK**: `Argon2id(recoveryCode, saltRecovery, kdfParams)`. Wraps a
  second copy of the DEK so the user can recover after a forgotten password.
- **authHash**: `Argon2id(password, saltAuth, kdfParams)`. This is the ONLY
  password-derived value sent to the server, and it is **not** a key - it's a
  login verifier. The server stores `argon2id(authHash)` (a second, server-side
  hashing) so a database leak does not even reveal the authHash.

The three salts are independent random values so the authHash, KEK, and recovery
KEK are unrelated.

## Flows

### Signup (all client-side)

1. `dek = randombytes_buf(32)`
2. `saltAuth, saltKek, saltRecovery = randombytes_buf(16) ×3`
3. `recoveryCode = randombytes_buf(32)` → display to user once (e.g. base64 or
   a mnemonic). Never stored by the client.
4. `kek = Argon2id(password, saltKek)`; `wrappedDek = nonce || AEAD(dek, kek)`
5. `recoveryKek = Argon2id(recoveryCode, saltRecovery)`;
   `wrappedDekRecovery = nonce || AEAD(dek, recoveryKek)`
6. `authHash = Argon2id(password, saltAuth)`
7. POST `/auth/signup` with `{ identifier, email?, authHash (b64), saltAuth (b64),
saltKek (b64), saltRecovery (b64), kdfParams, wrappedDek (b64),
wrappedDekRecovery (b64) }`.

The client keeps `dek` in memory only.

### Login

1. POST `/auth/prelogin { identifier }` → `{ saltAuth (b64), kdfParams }`.
   For unknown identifiers the server returns a **deterministic pseudo-salt**
   (`HMAC-SHA256(SERVER_SECRET, identifier)` truncated to 16 bytes) so attackers
   cannot enumerate accounts by observing whether a salt is returned.
2. `authHash = Argon2id(password, saltAuth)`
3. POST `/auth/login { identifier, authHash (b64) }` → on success
   `{ token, saltKek (b64), wrappedDek (b64), kdfParams }`.
4. `kek = Argon2id(password, saltKek)`; `dek = AEAD_open(wrappedDek, kek)`.
   Hold `dek` in memory only.

### Field encryption

For each sensitive value: `blob = nonce || AEAD(plaintext, dek)`; send/store the
base64. To read: `AEAD_open(blob, dek)`. Plaintext never touches the server.

Encrypted fields by resource (see `src/db/schema.ts`):

- **days**: `encDate`, `encDayType`
- **factors**: `encNotes`
- **categories** (user-owned only): `encName`, `encIcon`, `encColor`
- **categoryLevels** (user-owned only): `encName`, `encIcon`
- Global categories/levels are app-defined and stay plaintext.

### Password change

Re-derive `kek` from the new password (new `saltKek`), re-wrap the existing
`dek`, PATCH the new `saltKek` + `wrappedDek`. User data is untouched.

### Recovery

User supplies the `recoveryCode`; client derives `recoveryKek`, opens
`wrappedDekRecovery` to recover the `dek`, then sets a new password (as in
password change). **The server cannot recover - by design - so it cannot be
compelled to.**

## What stays plaintext (accepted leakage)

UUID keys, `created_at`/`updated_at`, a day's `order`, and global system
categories. Content-bearing filters (today/current/date-range) are therefore
done **client-side** after decryption; the server only supports filtering by id.

## Client key hygiene (web)

The DEK lives in memory only - never `localStorage`/`IndexedDB`. Re-prompt for
the password on each app launch; auto-lock and wipe the key on
background/timeout. A browser cannot securely wipe RAM nor fully control its own
on-disk caches, so this protects a **powered-off / locked** seized device but
not a live-surveilled one; a native client raises that ceiling later.
