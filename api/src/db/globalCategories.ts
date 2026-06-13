import { eq } from 'drizzle-orm';
import type { Database } from './index.js';
import { categories, categoryLevels } from './schema.js';

/**
 * The global, system-defined categories and their levels. NOT user secrets, so
 * stored in plaintext and readable by everyone. Ported from Rails db/seeds.rb.
 */
export const GLOBAL_CATEGORIES: {
  name: string;
  icon: string;
  color: string;
  levels: { name: string; icon: string }[];
}[] = [
  {
    name: 'Bleeding',
    icon: 'water',
    color: '#ff0000',
    levels: [
      { name: 'Light', icon: 'skateboarding' },
      { name: 'Medium', icon: 'skateboarding' },
      { name: 'Heavy', icon: 'skateboarding' },
    ],
  },
  {
    name: 'Spotting',
    icon: 'water',
    color: '#ff0000',
    levels: [
      { name: 'Red', icon: 'skateboarding' },
      { name: 'Brown', icon: 'skateboarding' },
    ],
  },
  {
    name: 'Pain',
    icon: 'water',
    color: '#ff0000',
    levels: [
      { name: 'Cramps', icon: 'skateboarding' },
      { name: 'Headache', icon: 'skateboarding' },
      { name: 'Backache', icon: 'skateboarding' },
    ],
  },
  {
    name: 'Mood',
    icon: 'water',
    color: '#ff0000',
    levels: [
      { name: 'Irritability', icon: 'skateboarding' },
      { name: 'Sadness', icon: 'skateboarding' },
      { name: 'Anger', icon: 'skateboarding' },
      { name: 'Happy', icon: 'skateboarding' },
      { name: 'Content', icon: 'skateboarding' },
    ],
  },
  {
    name: 'Energy',
    icon: 'water',
    color: '#ff0000',
    levels: [
      { name: 'Energetic', icon: 'skateboarding' },
      { name: 'Tired', icon: 'skateboarding' },
      { name: 'Exhausted', icon: 'skateboarding' },
    ],
  },
];

/** Insert (or re-insert) the global categories. Idempotent. */
export async function seedGlobalCategories(database: Database): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.delete(categories).where(eq(categories.global, true));

    for (const cat of GLOBAL_CATEGORIES) {
      const [inserted] = await tx
        .insert(categories)
        .values({ name: cat.name, icon: cat.icon, color: cat.color, global: true })
        .returning({ id: categories.id });
      if (!inserted) throw new Error(`Failed to insert category ${cat.name}`);

      await tx
        .insert(categoryLevels)
        .values(
          cat.levels.map((lvl) => ({ categoryId: inserted.id, name: lvl.name, icon: lvl.icon })),
        );
    }
  });
}

export const GLOBAL_CATEGORY_COUNT = GLOBAL_CATEGORIES.length;
export const GLOBAL_LEVEL_COUNT = GLOBAL_CATEGORIES.reduce((n, c) => n + c.levels.length, 0);
