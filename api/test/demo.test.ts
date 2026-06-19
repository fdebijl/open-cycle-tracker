import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, closeDb, crypto, registerUser, request, resetDb } from './helpers.js';
import { db } from '../src/db/index.js';
import { categories, users } from '../src/db/schema.js';
import { wipeAllData } from '../src/db/demoReset.js';
import { GLOBAL_CATEGORY_COUNT } from '../src/db/globalCategories.js';

beforeAll(async () => {
  await crypto.ready();
});
beforeEach(resetDb);
afterAll(closeDb);

describe('demo mode', () => {
  it('reports demoMode on /health (off in the test env)', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', demoMode: false });
  });

  it('wipeAllData clears user data and re-seeds the global categories', async () => {
    await registerUser({ identifier: 'demo-user' });
    expect(await db.select().from(users)).toHaveLength(1);

    await wipeAllData();

    expect(await db.select().from(users)).toHaveLength(0);
    // Globals are re-seeded; only globals exist after a wipe with no users.
    expect(await db.select().from(categories)).toHaveLength(GLOBAL_CATEGORY_COUNT);
  });
});
