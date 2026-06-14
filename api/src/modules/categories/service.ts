import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories, type Category } from '../../db/schema.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { encOut } from '../../lib/serialize.js';
import {
  assertCategoryReadable,
  assertCategoryWritable,
  categoryReadScope,
  type AuthContext,
} from '../../policies/index.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './schema.js';

export function serializeCategory(c: Category) {
  return {
    id: c.id,
    userId: c.userId,
    global: c.global,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    color: c.color,
    encName: encOut(c.encName),
    encIcon: encOut(c.encIcon),
    encColor: encOut(c.encColor),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Readable categories: the user's own plus global system categories. */
export async function listCategories(ctx: AuthContext, ids: string[] | null) {
  const scope = categoryReadScope(ctx);
  const where = ids ? and(scope, inArray(categories.id, ids)) : scope;
  const rows = await db.select().from(categories).where(where);
  return rows.map(serializeCategory);
}

export async function getCategory(id: string, ctx: AuthContext) {
  const row = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  assertCategoryReadable(row, ctx);
  return serializeCategory(row!);
}

export async function createCategory(ctx: AuthContext, input: CreateCategoryInput) {
  if (input.global) {
    if (!ctx.isAdmin) throw forbidden('Only admins can create global categories');
    const [row] = await db
      .insert(categories)
      .values({
        global: true,
        userId: null,
        name: input.name ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
      })
      .returning();
    if (!row) throw new Error('Failed to create category');
    return serializeCategory(row);
  }

  const [row] = await db
    .insert(categories)
    .values({
      global: false,
      userId: ctx.userId,
      encName: input.encName ?? null,
      encIcon: input.encIcon ?? null,
      encColor: input.encColor ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create category');
  return serializeCategory(row);
}

export async function updateCategory(id: string, ctx: AuthContext, input: UpdateCategoryInput) {
  const existing = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  assertCategoryWritable(existing, ctx);

  const patch: Partial<typeof categories.$inferInsert> = {};
  if (existing!.global) {
    if ('name' in input) patch.name = input.name ?? null;
    if ('icon' in input) patch.icon = input.icon ?? null;
    if ('color' in input) patch.color = input.color ?? null;
  } else {
    if ('encName' in input) patch.encName = input.encName ?? null;
    if ('encIcon' in input) patch.encIcon = input.encIcon ?? null;
    if ('encColor' in input) patch.encColor = input.encColor ?? null;
  }

  const [row] = await db.update(categories).set(patch).where(eq(categories.id, id)).returning();
  if (!row) throw notFound();
  return serializeCategory(row);
}

export async function deleteCategory(id: string, ctx: AuthContext) {
  const existing = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  assertCategoryWritable(existing, ctx);
  await db.delete(categories).where(eq(categories.id, id));
}
