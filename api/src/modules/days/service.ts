import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles, days, type Day } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { encOut } from '../../lib/serialize.js';
import type { AuthContext } from '../../policies/index.js';
import { serializeFactor } from '../factors/service.js';
import type { CreateDayInput, UpdateDayInput } from './schema.js';

export function serializeDay(d: Day) {
  return {
    id: d.id,
    cycleId: d.cycleId,
    userId: d.userId,
    encDate: encOut(d.encDate),
    encNotes: encOut(d.encNotes),
    order: d.order,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

async function assertOwnsCycle(cycleId: string, ctx: AuthContext) {
  const cycle = await db.query.cycles.findFirst({
    where: and(eq(cycles.id, cycleId), eq(cycles.userId, ctx.userId)),
    columns: { id: true },
  });
  if (!cycle) throw notFound('Cycle not found');
}

export async function listDays(ctx: AuthContext, ids: string[] | null) {
  const where = ids
    ? and(eq(days.userId, ctx.userId), inArray(days.id, ids))
    : eq(days.userId, ctx.userId);
  const rows = await db.select().from(days).where(where).orderBy(asc(days.order));
  return rows.map(serializeDay);
}

/** Show a day with its factors nested (mirrors the Rails DaySerializer). */
export async function getDay(id: string, ctx: AuthContext) {
  const row = await db.query.days.findFirst({
    where: and(eq(days.id, id), eq(days.userId, ctx.userId)),
    with: { factors: true },
  });
  if (!row) throw notFound();
  const { factors, ...day } = row;
  return { ...serializeDay(day), factors: factors.map(serializeFactor) };
}

export async function createDay(ctx: AuthContext, input: CreateDayInput) {
  await assertOwnsCycle(input.cycleId, ctx);
  const [row] = await db
    .insert(days)
    .values({
      cycleId: input.cycleId,
      userId: ctx.userId,
      encDate: input.encDate,
      encNotes: input.encNotes ?? null,
      order: input.order ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create day');
  return serializeDay(row);
}

export async function updateDay(id: string, ctx: AuthContext, input: UpdateDayInput) {
  const patch: Partial<typeof days.$inferInsert> = {};
  if ('encDate' in input && input.encDate) patch.encDate = input.encDate;
  if ('encNotes' in input) patch.encNotes = input.encNotes ?? null;
  if ('order' in input) patch.order = input.order ?? null;

  const [row] = await db
    .update(days)
    .set(patch)
    .where(and(eq(days.id, id), eq(days.userId, ctx.userId)))
    .returning();
  if (!row) throw notFound();
  return serializeDay(row);
}

export async function deleteDay(id: string, ctx: AuthContext) {
  const [row] = await db
    .delete(days)
    .where(and(eq(days.id, id), eq(days.userId, ctx.userId)))
    .returning({ id: days.id });
  if (!row) throw notFound();
}
