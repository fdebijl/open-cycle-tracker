# Open Cycle Tracker - UI (React)

The Open Cycle Tracker web client. A full React rewrite that replaced the
original Ember app. Its defining feature is **client-side end-to-end
encryption**: the server stores only opaque ciphertext and never holds a key.

## Stack

- Vite + React + TypeScript (SPA - deliberately no SSR, so keys/plaintext never
  touch a server)
- React Router, TanStack Query, Zustand
- `libsodium-wrappers-sumo` (Argon2id + XChaCha20-Poly1305), run in a Web Worker
- `@scure/bip39` (recovery mnemonic)
- CSS Modules (`.module.scss`)

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:5173 (the API's CORS_ORIGINS default)
pnpm test       # Vitest - crypto round-trip + no-plaintext + mapper tests
pnpm build      # tsc -b + vite build
```

The API (`../api`) must be running at `VITE_API_URL` (default
`http://localhost:3000`) with this origin in its `CORS_ORIGINS`.

## Crypto architecture (`src/crypto/`)

- `sodium.ts` - initializes the libsodium **sumo** build (the standard build
  omits `crypto_pwhash`/Argon2id).
- `primitives.ts` - pure `deriveKeyRaw` (Argon2id), `aeadEncrypt/Decrypt`
  (XChaCha20-Poly1305, blob = `nonce(24) || ct+tag`), RNG, KDF param presets.
- `worker.ts` + `kdf.ts` - the slow KDF runs in a Web Worker; `kdf.deriveKey`
  is the wrapper everything calls (falls back to inline in Node/tests).
- `envelope.ts` - signup envelope, login DEK unwrap, recovery, password re-wrap,
  recovery verifier.
- `fields.ts` - field-level encrypt/decrypt for the data layer.
- `codec.ts` - base64 + BIP39 mnemonic encode/decode.

### Recovery code encoding

The recovery secret is 32 random bytes. The user is shown a **BIP39 mnemonic**
of those bytes, but the KDF input (for the recovery KEK and the recovery
verifier) is the **base64 string** of the same bytes - matching the API's
reference `crypto-client`, so the two implementations are interoperable.

### Key hygiene

The DEK lives **only in memory** (`src/stores/vault.ts`) - never
localStorage/IndexedDB. A full reload wipes it (re-login each launch); an
auto-lock (inactivity timer + tab-hidden) wipes just the DEK so the user can
re-unlock with their password alone.

## Layout

- `src/crypto/` - the E2EE implementation (above).
- `src/api/` - typed fetch client + resource/auth endpoints + DTOs.
- `src/data/` - the decrypt/encrypt mapper boundary + TanStack Query hooks.
- `src/auth/session.ts` - login / signup / unlock / recover / change-password.
- `src/stores/vault.ts` - in-memory key vault + auto-lock.
- `src/routes/`, `src/components/` - screens and UI.
