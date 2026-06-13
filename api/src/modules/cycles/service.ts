import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles, type Cycle } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import type { AuthContext } from '../../policies/index.js';

export function serializeCycle(c: Cycle) {
  return { id: c.id, userId: c.userId, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

export async function listCycles(ctx: AuthContext, ids: string[] | null) {
  const where = ids
    ? and(eq(cycles.userId, ctx.userId), inArray(cycles.id, ids))
    : eq(cycles.userId, ctx.userId);
  const rows = await db.select().from(cycles).where(where).orderBy(desc(cycles.createdAt));
  return rows.map(serializeCycle);
}

export async function getCycle(id: string, ctx: AuthContext) {
  const row = await db.query.cycles.findFirst({
    where: and(eq(cycles.id, id), eq(cycles.userId, ctx.userId)),
  });
  if (!row) throw notFound();
  return serializeCycle(row);
}

export async function createCycle(ctx: AuthContext) {
  const [row] = await db.insert(cycles).values({ userId: ctx.userId }).returning();
  if (!row) throw new Error('Failed to create cycle');
  return serializeCycle(row);
}

export async function deleteCycle(id: string, ctx: AuthContext) {
  const [row] = await db
    .delete(cycles)
    .where(and(eq(cycles.id, id), eq(cycles.userId, ctx.userId)))
    .returning({ id: cycles.id });
  if (!row) throw notFound();
}
