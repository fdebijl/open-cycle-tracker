import { db, pool } from './index.js';
import {
  GLOBAL_CATEGORY_COUNT,
  GLOBAL_LEVEL_COUNT,
  seedGlobalCategories,
} from './globalCategories.js';

async function main() {
  await seedGlobalCategories(db);
  console.log(
    `Seeded ${GLOBAL_CATEGORY_COUNT} global categories with ${GLOBAL_LEVEL_COUNT} levels.`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
