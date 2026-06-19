import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { seedGlobalCategories } from './globalCategories.js';

/**
 * Truncate every user-data table and re-seed the global categories. Used by the
 * demo deployment's periodic wipe (see src/index.ts) and by the test harness
 * (test/helpers.ts) so the two never drift. Destructive: only call when demo
 * mode is on or in tests.
 */
export async function wipeAllData(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE users, cycles, days, categories, category_levels, factors, revoked_tokens RESTART IDENTITY CASCADE`,
  );
  await seedGlobalCategories(db);
}
