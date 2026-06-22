import type { Request } from 'express';
import { eq, or, type SQL } from 'drizzle-orm';
import { forbidden, notFound } from '../lib/errors.js';
import { requireAuthCtx } from '../middleware/requireAuth.js';
import { categories } from '../db/schema.js';

export type AuthContext = { userId: string; isAdmin: boolean };

export function authContext(req: Request): AuthContext {
  const a = requireAuthCtx(req);
  return { userId: a.userId, isAdmin: a.isAdmin };
}

type Owned = { userId: string | null } | undefined | null;

/** Owned-resource read/write guard: must belong to the requester, else 404. */
export function assertOwner(record: Owned, ctx: AuthContext): void {
  if (!record || record.userId !== ctx.userId) throw notFound();
}

type CategoryLike = { userId: string | null; global: boolean } | undefined | null;

export function assertCategoryReadable(record: CategoryLike, ctx: AuthContext): void {
  if (!record) throw notFound();
  if (record.global) return;
  if (record.userId !== ctx.userId) throw notFound();
}

export function assertCategoryWritable(record: CategoryLike, ctx: AuthContext): void {
  if (!record) throw notFound();
  if (record.global) {
    if (!ctx.isAdmin) throw forbidden('Only admins can modify global categories');
    return;
  }
  if (record.userId !== ctx.userId) throw notFound();
}

// Owned resources scope with a plain `eq(table.userId, ctx.userId)` in the
// service. Categories need own-OR-global, so that predicate is provided here.

/** WHERE predicate for categories: own rows OR global rows. */
export function categoryReadScope(ctx: AuthContext): SQL {
  return or(eq(categories.userId, ctx.userId), eq(categories.global, true)) as SQL;
}
