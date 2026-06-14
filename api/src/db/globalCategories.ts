import { and, eq, isNull, notInArray } from 'drizzle-orm';
import type { Database } from './index.js';
import { categories, categoryLevels } from './schema.js';

/**
 * The global, system-defined categories and their levels. NOT user secrets, so
 * stored in plaintext and readable by everyone.
 *
 * Evidence-based coverage (high + medium priority) drawn from Li et al. 2020's
 * analysis of 378k Clue users - see docs/symptom-tracking.md. Each category
 * carries a stable `slug`: most are cosmetic, but the client keys real behaviour
 * off two of them - `flow` is the period/onset signal (an ordinal scale that
 * replaces the old Bleeding + Spotting categories and the `period` day type) and
 * `bbt` renders a numeric input whose reading lives in the (encrypted)
 * `factors.encValue` rather than a discrete level.
 *
 * Level `order` is the ordinal position within the category. It's meaningful for
 * ordered scales (Flow, Sleep) and harmless display order for the rest.
 */
export const GLOBAL_CATEGORIES: {
  slug: string;
  name: string;
  icon: string;
  color: string;
  levels: { name: string }[];
}[] = [
  {
    slug: 'flow',
    name: 'Flow',
    icon: 'water',
    color: '#e76666',
    // Ordinal: spotting < light < medium < heavy. `order` >= Light marks a
    // period (onset) day client-side.
    levels: [{ name: 'Spotting' }, { name: 'Light' }, { name: 'Medium' }, { name: 'Heavy' }],
  },
  {
    slug: 'fluid',
    name: 'Cervical fluid',
    icon: 'water-outline',
    color: '#778cfa',
    levels: [{ name: 'Creamy' }, { name: 'Egg-white' }, { name: 'Sticky' }, { name: 'Atypical' }],
  },
  {
    slug: 'bbt',
    name: 'Basal body temperature',
    icon: 'thermometer',
    color: '#f0a35e',
    // Single placeholder level; the reading is the encrypted numeric encValue.
    levels: [{ name: 'Reading' }],
  },
  {
    slug: 'sex',
    name: 'Sex',
    icon: 'heart-outline',
    color: '#d6649b',
    levels: [
      { name: 'Unprotected' },
      { name: 'Protected' },
      { name: 'Withdrawal' },
      { name: 'High drive' },
      { name: 'Low drive' },
    ],
  },
  {
    slug: 'pain',
    name: 'Pain',
    icon: 'lightning-bolt',
    color: '#d14a4a',
    levels: [
      { name: 'Cramps' },
      { name: 'Headache' },
      { name: 'Backache' },
      { name: 'Tender breasts' },
      { name: 'Ovulation pain' },
    ],
  },
  {
    slug: 'mood',
    name: 'Mood',
    icon: 'emoticon-outline',
    color: '#fbc87b',
    levels: [
      { name: 'Irritability' },
      { name: 'Sadness' },
      { name: 'Anger' },
      { name: 'Happy' },
      { name: 'Content' },
      { name: 'PMS' },
    ],
  },
  {
    slug: 'energy',
    name: 'Energy',
    icon: 'battery-charging',
    color: '#7bbf6a',
    levels: [{ name: 'Energized' }, { name: 'Energetic' }, { name: 'Tired' }, { name: 'Exhausted' }],
  },
  {
    slug: 'sleep',
    name: 'Sleep',
    icon: 'sleep',
    color: '#6a6fbf',
    // Ordinal hours-slept buckets.
    levels: [{ name: '< 3h' }, { name: '3–6h' }, { name: '6–9h' }, { name: '> 9h' }],
  },
  {
    slug: 'skin',
    name: 'Skin',
    icon: 'face-woman-outline',
    color: '#c98fb0',
    levels: [{ name: 'Acne' }, { name: 'Good' }, { name: 'Oily' }, { name: 'Dry' }],
  },
  {
    slug: 'mental',
    name: 'Mental',
    icon: 'brain',
    color: '#8e7bbf',
    levels: [{ name: 'Calm' }, { name: 'Distracted' }, { name: 'Focused' }, { name: 'Stressed' }],
  },
  {
    slug: 'craving',
    name: 'Craving',
    icon: 'food-apple',
    color: '#e0a85e',
    levels: [{ name: 'Sweet' }, { name: 'Salty' }, { name: 'Carbs' }, { name: 'Chocolate' }],
  },
  {
    slug: 'digestion',
    name: 'Digestion',
    icon: 'stomach',
    color: '#9bbf6a',
    levels: [{ name: 'Great' }, { name: 'Bloated' }, { name: 'Gassy' }, { name: 'Nauseated' }],
  },
  {
    slug: 'medication',
    name: 'Medication',
    icon: 'pill',
    color: '#5ec0c0',
    levels: [
      { name: 'Pain relief' },
      { name: 'Cold / flu' },
      { name: 'Antihistamine' },
      { name: 'Antibiotic' },
      { name: 'Birth control' },
      { name: 'Pregnancy test +' },
      { name: 'Pregnancy test −' },
    ],
  },
  {
    slug: 'collection',
    name: 'Collection method',
    icon: 'cup',
    color: '#b06a8f',
    levels: [{ name: 'Pad' }, { name: 'Tampon' }, { name: 'Panty liner' }, { name: 'Cup' }],
  },
];

/**
 * Insert or update the global categories, idempotently and (unlike a naive
 * delete-all) WITHOUT cascade-deleting users' factors on every run. Categories
 * are matched by `slug` and levels by name within their category; only globals
 * no longer present in the seed are removed (which does cascade - acceptable,
 * those levels carry no current data).
 */
export async function seedGlobalCategories(database: Database): Promise<void> {
  await database.transaction(async (tx) => {
    const slugs = GLOBAL_CATEGORIES.map((c) => c.slug);

    // Drop global categories that are no longer defined, plus any legacy
    // pre-slug globals (their `slug` is null, so notInArray won't catch them).
    await tx.delete(categories).where(and(eq(categories.global, true), notInArray(categories.slug, slugs)));
    await tx.delete(categories).where(and(eq(categories.global, true), isNull(categories.slug)));

    for (const cat of GLOBAL_CATEGORIES) {
      const found = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.global, true), eq(categories.slug, cat.slug)));

      let categoryId: string;
      if (found[0]) {
        categoryId = found[0].id;
        await tx
          .update(categories)
          .set({ name: cat.name, icon: cat.icon, color: cat.color })
          .where(eq(categories.id, categoryId));
      } else {
        const [inserted] = await tx
          .insert(categories)
          .values({ slug: cat.slug, name: cat.name, icon: cat.icon, color: cat.color, global: true })
          .returning({ id: categories.id });
        if (!inserted) throw new Error(`Failed to insert category ${cat.slug}`);
        categoryId = inserted.id;
      }

      // Reconcile this category's levels by name; remove ones dropped from the seed.
      const names = cat.levels.map((l) => l.name);
      await tx
        .delete(categoryLevels)
        .where(and(eq(categoryLevels.categoryId, categoryId), notInArray(categoryLevels.name, names)));

      for (let order = 0; order < cat.levels.length; order += 1) {
        const lvl = cat.levels[order]!;
        const existing = await tx
          .select({ id: categoryLevels.id })
          .from(categoryLevels)
          .where(and(eq(categoryLevels.categoryId, categoryId), eq(categoryLevels.name, lvl.name)));
        if (existing[0]) {
          await tx.update(categoryLevels).set({ order }).where(eq(categoryLevels.id, existing[0].id));
        } else {
          await tx.insert(categoryLevels).values({ categoryId, name: lvl.name, order });
        }
      }
    }
  });
}

export const GLOBAL_CATEGORY_COUNT = GLOBAL_CATEGORIES.length;
export const GLOBAL_LEVEL_COUNT = GLOBAL_CATEGORIES.reduce((n, c) => n + c.levels.length, 0);

/** The slug whose flow factors mark a period/onset day. */
export const FLOW_SLUG = 'flow';
/** Flow levels at this ordinal or above count as a period (onset) day; below is
 * spotting only. Spotting = order 0, Light = 1. */
export const FLOW_PERIOD_MIN_ORDER = 1;
/** The slug rendered as a numeric reading (BBT) backed by factors.encValue. */
export const BBT_SLUG = 'bbt';
