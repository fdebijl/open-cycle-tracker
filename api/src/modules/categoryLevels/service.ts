import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories, categoryLevels, type CategoryLevel } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { encOut } from '../../lib/serialize.js';
import {
  assertCategoryReadable,
  assertCategoryWritable,
  categoryReadScope,
  type AuthContext,
} from '../../policies/index.js';
import type { CreateCategoryLevelInput, UpdateCategoryLevelInput } from './schema.js';

export function serializeCategoryLevel(l: CategoryLevel) {
  return {
    id: l.id,
    categoryId: l.categoryId,
    order: l.order,
    name: l.name,
    icon: l.icon,
    encName: encOut(l.encName),
    encIcon: encOut(l.encIcon),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

/** Levels under a category the user can read (own or global). */
export async function listCategoryLevels(ctx: AuthContext, ids: string[] | null) {
  const scope = ids
    ? and(categoryReadScope(ctx), inArray(categoryLevels.id, ids))
    : categoryReadScope(ctx);
  const rows = await db
    .select({ level: categoryLevels })
    .from(categoryLevels)
    .innerJoin(categories, eq(categoryLevels.categoryId, categories.id))
    .where(scope);
  return rows.map((r) => serializeCategoryLevel(r.level));
}

export async function getCategoryLevel(id: string, ctx: AuthContext) {
  const row = await db.query.categoryLevels.findFirst({
    where: eq(categoryLevels.id, id),
    with: { category: true },
  });
  if (!row) throw notFound();
  assertCategoryReadable(row.category, ctx);
  return serializeCategoryLevel(row);
}

export async function createCategoryLevel(ctx: AuthContext, input: CreateCategoryLevelInput) {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, input.categoryId),
  });
  assertCategoryWritable(category, ctx);

  const values = category!.global
    ? { categoryId: input.categoryId, name: input.name ?? null, icon: input.icon ?? null }
    : {
        categoryId: input.categoryId,
        encName: input.encName ?? null,
        encIcon: input.encIcon ?? null,
      };

  const [row] = await db.insert(categoryLevels).values(values).returning();
  if (!row) throw new Error('Failed to create category level');
  return serializeCategoryLevel(row);
}

export async function updateCategoryLevel(
  id: string,
  ctx: AuthContext,
  input: UpdateCategoryLevelInput,
) {
  const existing = await db.query.categoryLevels.findFirst({
    where: eq(categoryLevels.id, id),
    with: { category: true },
  });
  if (!existing) throw notFound();
  assertCategoryWritable(existing.category, ctx);

  const patch: Partial<typeof categoryLevels.$inferInsert> = {};
  if (existing.category.global) {
    if ('name' in input) patch.name = input.name ?? null;
    if ('icon' in input) patch.icon = input.icon ?? null;
  } else {
    if ('encName' in input) patch.encName = input.encName ?? null;
    if ('encIcon' in input) patch.encIcon = input.encIcon ?? null;
  }

  const [row] = await db
    .update(categoryLevels)
    .set(patch)
    .where(eq(categoryLevels.id, id))
    .returning();
  if (!row) throw notFound();
  return serializeCategoryLevel(row);
}

export async function deleteCategoryLevel(id: string, ctx: AuthContext) {
  const existing = await db.query.categoryLevels.findFirst({
    where: eq(categoryLevels.id, id),
    with: { category: true },
  });
  if (!existing) throw notFound();
  assertCategoryWritable(existing.category, ctx);
  await db.delete(categoryLevels).where(eq(categoryLevels.id, id));
}
