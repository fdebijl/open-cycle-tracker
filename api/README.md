# Open Cycle Tracker API

Self-hosted, **end-to-end-encrypted** menstrual cycle tracker API. Node.js +
TypeScript + Express, PostgreSQL via Drizzle.

## Why E2EE

This project exists for a threat model where an adversary may **seize the
hosting server and/or the user's device** and may **legally compel the
operator**. So the server is a near-dumb **ciphertext + metadata store**: all
user content (cycle dates, day types, symptom notes, profile) is encrypted on
the client with keys the server never sees and **cannot** recover. See
[`docs/encryption.md`](docs/encryption.md) for the full contract and
[`docs/REWRITE_PLAN.md`](docs/REWRITE_PLAN.md) for the design rationale and the
explicit limits (e.g. a live-surveilled device can't be defended at the app
layer).

## Stack

- **Express** (plain JSON API)
- **Drizzle ORM** + PostgreSQL (UUID keys, `bytea` ciphertext columns)
- **Auth**: hand-rolled JWT (argon2id verifier, jti denylist revocation),
  pseudonymous accounts (username; email optional)
- **Authorization**: hand-rolled policy modules (ownership + global/admin
  categories)
- **Crypto (client)**: libsodium - Argon2id KDF, XChaCha20-Poly1305 AEAD
- **Validation**: Zod · **Tests**: Vitest + Supertest

## Setup

Requires Node 20+ and PostgreSQL.

```bash
pnpm install
cp .env.example .env            # then edit secrets
createdb oct_dev && createdb oct_test
pnpm db:migrate                 # apply migrations to oct_dev
pnpm db:seed                    # seed global categories
DATABASE_URL=postgres://.../oct_test pnpm db:migrate   # set up the test DB
pnpm dev                        # start with reload on :3000
```

Generate strong secrets for `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Scripts

| Command                            | Description                          |
| ---------------------------------- | ------------------------------------ |
| `pnpm dev`                         | Run with reload (tsx watch)          |
| `pnpm build` / `pnpm start`        | Bundle to `dist/` and run            |
| `pnpm typecheck`                   | `tsc --noEmit`                       |
| `pnpm lint` / `pnpm format`        | ESLint / Prettier                    |
| `pnpm test`                        | Vitest + Supertest (uses `oct_test`) |
| `pnpm db:generate`                 | Generate a migration from the schema |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / seed globals      |

## API

All routes return plain JSON. Authenticate with `Authorization: Bearer <token>`.
Encrypted fields are base64 of the ciphertext blob (`nonce || ciphertext+tag`).

- `POST /auth/prelogin` → `{ saltAuth, kdfParams }` (stable pseudo-salt for
  unknown users to prevent enumeration)
- `POST /auth/signup` → `{ token, user, saltKek, wrappedDek, kdfParams }`
- `POST /auth/login` → same shape as signup
- `DELETE /auth/logout` → revokes the current token (jti denylist)
- `GET|PATCH|DELETE /users/:id` (self only)
- `GET /cycles`, `GET /cycles/:id`, `POST /cycles`, `DELETE /cycles/:id`
- `GET /days`, `GET /days/:id` (nests factors), `POST /days`, `PATCH /days/:id`,
  `DELETE /days/:id`
- `GET|POST /categories`, `GET|PATCH|DELETE /categories/:id` (own + global)
- `GET|POST /category_levels`, `GET|PATCH|DELETE /category_levels/:id`
- `GET|POST /factors`, `GET|PATCH|DELETE /factors/:id`

Collection routes accept `?filter[id]=uuid1,uuid2`. Content-based filtering
(today/current/date-range) is done **client-side** because those fields are
ciphertext.

## Security notes

- No request logging of IPs, headers, query, or bodies (`src/middleware/httpLogger.ts`).
- Strict CORS allowlist via `CORS_ORIGINS` (no wildcard).
- Rate limiting on auth endpoints (`express-rate-limit`).
- Cross-user access to owned resources returns `404` (never reveals existence).
- Run behind TLS; if behind a proxy, set Express `trust proxy` appropriately.
