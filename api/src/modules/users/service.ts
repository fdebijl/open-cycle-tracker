import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, type User } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { encOut } from '../../lib/serialize.js';
import type { AuthContext } from '../../policies/index.js';
import type { UpdateUserInput } from './schema.js';

export function serializeUser(u: User) {
  return {
    id: u.id,
    identifier: u.identifier,
    email: u.email,
    isAdmin: u.isAdmin,
    encName: encOut(u.encName),
    encInfo: encOut(u.encInfo),
    encSettings: encOut(u.encSettings),
    // Whether duress/destruction passwords are set (roadmap #14). Booleans only -
    // never the verifiers. On a decoy session these read false (the shadow has no
    // decoy of its own), so the real config is not revealed inside duress mode.
    duressConfigured: u.duressAuthHash !== null,
    destructConfigured: u.destructAuthHash !== null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Users may only read their own record (mirrors UserPolicy). */
export async function getUser(id: string, ctx: AuthContext) {
  if (id !== ctx.userId) throw notFound();
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw notFound();
  return serializeUser(user);
}

export async function updateUser(id: string, ctx: AuthContext, input: UpdateUserInput) {
  if (id !== ctx.userId) throw notFound();

  // Only set keys the client actually provided.
  const patch: Partial<typeof users.$inferInsert> = {};
  if ('email' in input) patch.email = input.email ?? null;
  if ('encName' in input) patch.encName = input.encName ?? null;
  if ('encInfo' in input) patch.encInfo = input.encInfo ?? null;
  if ('encSettings' in input) patch.encSettings = input.encSettings ?? null;

  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (!updated) throw notFound();
  return serializeUser(updated);
}

/** Account deletion. Cascades to all cycles/days/factors/categories. */
export async function deleteUser(id: string, ctx: AuthContext) {
  if (id !== ctx.userId) throw notFound();
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) throw notFound();
}
