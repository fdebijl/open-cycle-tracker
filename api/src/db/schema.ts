import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Open Cycle Tracker schema.
 *
 * SECURITY MODEL: this server is a near-dumb ciphertext + metadata store. All
 * user-sensitive content (cycle dates, day types, symptom notes, custom
 * category labels, user info/settings) is end-to-end encrypted by the client
 * with a key the server never sees. Those columns are `bytea` blobs the server
 * treats as opaque (see docs/encryption.md).
 *
 * Only the following stay plaintext, by design:
 *  - UUID primary/foreign keys (needed for relations; reveal no content)
 *  - row-level created_at/updated_at (accepted metadata leakage)
 *  - the `order` index on a day (low sensitivity, needed for stable sort)
 *  - `global` system categories/levels (app-defined, not user secrets)
 */

/** A ciphertext blob: nonce || ciphertext || tag, produced client-side. */
const cipher = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

/**
 * Pseudonymous accounts. `identifier` is a username (email is optional and
 * left null by default — it ties a real identity to "uses a cycle tracker").
 *
 * The server stores only what it needs to (a) authenticate and (b) hand the
 * client back the material it needs to derive keys. It can decrypt NOTHING:
 *  - authHash      : argon2id(client-derived authHash) — proves knowledge of
 *                    the password without being a key
 *  - salts + kdfParams: public KDF inputs returned to the client so it can
 *                    re-derive the KEK / recovery KEK
 *  - wrappedDek*   : the data key encrypted under the password-derived KEK and
 *                    (separately) under the recovery-code-derived KEK
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    identifier: text('identifier').notNull(),
    email: text('email'),

    // Server-side verifier: argon2id of the client's authHash (double hashing).
    authHash: text('auth_hash').notNull(),
    // Server-side verifier for the recovery code, derived the same way as
    // authHash but from the recovery code (not the password). Gates the
    // forgotten-password flow so only someone holding the recovery code can
    // overwrite the account's key material.
    recoveryAuthHash: text('recovery_auth_hash').notNull(),

    // Public KDF inputs (not secret) returned to the client.
    saltAuth: text('salt_auth').notNull(),
    saltKek: text('salt_kek').notNull(),
    saltRecovery: text('salt_recovery').notNull(),
    // Independent salt for the recovery auth verifier (kept distinct from
    // saltRecovery so the verifier is not equal to the recovery KEK).
    saltRecoveryAuth: text('salt_recovery_auth').notNull(),
    kdfParams: jsonb('kdf_params').$type<KdfParams>().notNull(),

    // Envelope: DEK wrapped under the password KEK and under the recovery KEK.
    wrappedDek: cipher('wrapped_dek').notNull(),
    wrappedDekRecovery: cipher('wrapped_dek_recovery').notNull(),

    isAdmin: boolean('is_admin').notNull().default(false),

    // Encrypted user profile (parity with the Rails name/info/settings columns).
    // Optional — clients set them after signup. Server cannot read them.
    encName: cipher('enc_name'),
    encInfo: cipher('enc_info'),
    encSettings: cipher('enc_settings'),

    ...timestamps,
  },
  (t) => [uniqueIndex('users_identifier_key').on(t.identifier)],
);

export type KdfParams = {
  algorithm: 'argon2id';
  opsLimit: number;
  memLimit: number;
};

/**
 * JWT revocation denylist (replaces Devise's single-jti JTIMatcher; supports
 * multiple concurrent devices). A token is valid only if its jti is absent
 * here. Rows past expires_at can be pruned.
 */
export const revokedTokens = pgTable('revoked_tokens', {
  jti: text('jti').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tracking domain
// ---------------------------------------------------------------------------

/** A cycle groups days. No sensitive fields — date range derives client-side. */
export const cycles = pgTable('cycles', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
});

/**
 * A day within a cycle. The actual calendar date and the day type are
 * encrypted (`encDate`, `encDayType`). `order` stays plaintext for stable
 * sorting. NOTE: the Rails app had a UNIQUE index on `date`; that's impossible
 * on non-deterministic ciphertext, so per-cycle date uniqueness is enforced
 * client-side.
 */
export const days = pgTable('days', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cycleId: uuid('cycle_id')
    .notNull()
    .references(() => cycles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  encDate: cipher('enc_date').notNull(),
  encDayType: cipher('enc_day_type').notNull(),
  order: integer('order'),
  ...timestamps,
});

/**
 * Categories are two-tier:
 *  - global system categories (`global = true`, `userId = null`): app-defined,
 *    NOT user secrets, so name/icon/color stay plaintext and are readable by
 *    everyone.
 *  - user categories (`global = false`, `userId` set): the label/icon/color
 *    are user content, so they're stored encrypted in encName/encIcon/encColor
 *    and the plaintext columns stay null.
 */
export const categories = pgTable('categories', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  global: boolean('global').notNull().default(false),

  // Plaintext, global categories only.
  name: text('name'),
  icon: text('icon'),
  color: text('color'),

  // Encrypted, user categories only.
  encName: cipher('enc_name'),
  encIcon: cipher('enc_icon'),
  encColor: cipher('enc_color'),

  ...timestamps,
});

/** Discrete levels within a category. Same two-tier plaintext/encrypted rule. */
export const categoryLevels = pgTable('category_levels', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),

  name: text('name'),
  icon: text('icon'),

  encName: cipher('enc_name'),
  encIcon: cipher('enc_icon'),

  ...timestamps,
});

/** A symptom/metric reading on a day at a given category level. */
export const factors = pgTable('factors', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  dayId: uuid('day_id')
    .notNull()
    .references(() => days.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  categoryLevelId: uuid('category_level_id')
    .notNull()
    .references(() => categoryLevels.id, { onDelete: 'cascade' }),
  encNotes: cipher('enc_notes'),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  cycles: many(cycles),
  days: many(days),
  categories: many(categories),
  factors: many(factors),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  user: one(users, { fields: [cycles.userId], references: [users.id] }),
  days: many(days),
}));

export const daysRelations = relations(days, ({ one, many }) => ({
  user: one(users, { fields: [days.userId], references: [users.id] }),
  cycle: one(cycles, { fields: [days.cycleId], references: [cycles.id] }),
  factors: many(factors),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  levels: many(categoryLevels),
}));

export const categoryLevelsRelations = relations(categoryLevels, ({ one, many }) => ({
  category: one(categories, { fields: [categoryLevels.categoryId], references: [categories.id] }),
  factors: many(factors),
}));

export const factorsRelations = relations(factors, ({ one }) => ({
  day: one(days, { fields: [factors.dayId], references: [days.id] }),
  user: one(users, { fields: [factors.userId], references: [users.id] }),
  categoryLevel: one(categoryLevels, {
    fields: [factors.categoryLevelId],
    references: [categoryLevels.id],
  }),
}));

// Convenience row types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Cycle = typeof cycles.$inferSelect;
export type Day = typeof days.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CategoryLevel = typeof categoryLevels.$inferSelect;
export type Factor = typeof factors.$inferSelect;
