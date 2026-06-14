import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories, categoryLevels, days, factors, type Factor } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { encOut } from '../../lib/serialize.js';
import { categoryReadScope, type AuthContext } from '../../policies/index.js';
import type { CreateFactorInput, UpdateFactorInput } from './schema.js';

export function serializeFactor(f: Factor) {
  return {
    id: f.id,
    dayId: f.dayId,
    userId: f.userId,
    categoryLevelId: f.categoryLevelId,
    encNotes: encOut(f.encNotes),
    encValue: encOut(f.encValue),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

async function assertOwnsDay(dayId: string, ctx: AuthContext) {
  const day = await db.query.days.findFirst({
    where: and(eq(days.id, dayId), eq(days.userId, ctx.userId)),
    columns: { id: true },
  });
  if (!day) throw notFound('Day not found');
}

/** The level must belong to a category the user can read (own or global). */
async function assertReadableLevel(levelId: string, ctx: AuthContext) {
  const [row] = await db
    .select({ id: categoryLevels.id })
    .from(categoryLevels)
    .innerJoin(categories, eq(categoryLevels.categoryId, categories.id))
    .where(and(eq(categoryLevels.id, levelId), categoryReadScope(ctx)));
  if (!row) throw notFound('Category level not found');
}

export async function listFactors(ctx: AuthContext, ids: string[] | null) {
  const where = ids
    ? and(eq(factors.userId, ctx.userId), inArray(factors.id, ids))
    : eq(factors.userId, ctx.userId);
  const rows = await db.select().from(factors).where(where);
  return rows.map(serializeFactor);
}

export async function getFactor(id: string, ctx: AuthContext) {
  const row = await db.query.factors.findFirst({
    where: and(eq(factors.id, id), eq(factors.userId, ctx.userId)),
  });
  if (!row) throw notFound();
  return serializeFactor(row);
}

export async function createFactor(ctx: AuthContext, input: CreateFactorInput) {
  await assertOwnsDay(input.dayId, ctx);
  await assertReadableLevel(input.categoryLevelId, ctx);

  const [row] = await db
    .insert(factors)
    .values({
      dayId: input.dayId,
      userId: ctx.userId,
      categoryLevelId: input.categoryLevelId,
      encNotes: input.encNotes ?? null,
      encValue: input.encValue ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create factor');
  return serializeFactor(row);
}

export async function updateFactor(id: string, ctx: AuthContext, input: UpdateFactorInput) {
  const patch: Partial<typeof factors.$inferInsert> = {};
  if ('encNotes' in input) patch.encNotes = input.encNotes ?? null;
  if ('encValue' in input) patch.encValue = input.encValue ?? null;

  const [row] = await db
    .update(factors)
    .set(patch)
    .where(and(eq(factors.id, id), eq(factors.userId, ctx.userId)))
    .returning();
  if (!row) throw notFound();
  return serializeFactor(row);
}

export async function deleteFactor(id: string, ctx: AuthContext) {
  const [row] = await db
    .delete(factors)
    .where(and(eq(factors.id, id), eq(factors.userId, ctx.userId)))
    .returning({ id: factors.id });
  if (!row) throw notFound();
}
