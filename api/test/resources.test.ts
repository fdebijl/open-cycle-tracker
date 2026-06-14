import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { days } from '../src/db/schema.js';
import { GLOBAL_CATEGORY_COUNT } from '../src/db/globalCategories.js';
import {
  app,
  auth,
  closeDb,
  crypto,
  dec,
  enc,
  makeAdmin,
  registerUser,
  request,
  resetDb,
} from './helpers.js';

beforeAll(async () => {
  await crypto.ready();
});
beforeEach(resetDb);
afterAll(closeDb);

describe('cycles / days / factors CRUD with E2EE payloads', () => {
  it('creates a cycle, an encrypted day, and a factor; reads them back decrypted', async () => {
    const u = await registerUser();

    const cycle = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    const cycleId = cycle.body.id;

    const day = await request(app)
      .post('/days')
      .set(auth(u.token))
      .send({
        cycleId,
        encDate: enc('2026-06-13', u.dek),
        encNotes: enc('cramps all day', u.dek),
        order: 1,
      })
      .expect(201);

    // Server returns ciphertext; only the client (with the DEK) can read it.
    expect(dec(day.body.encDate, u.dek)).toBe('2026-06-13');
    expect(dec(day.body.encNotes, u.dek)).toBe('cramps all day');

    // Attach a factor referencing a global category level.
    const levels = await request(app).get('/category_levels').set(auth(u.token)).expect(200);
    const levelId = levels.body[0].id;

    const factor = await request(app)
      .post('/factors')
      .set(auth(u.token))
      .send({ dayId: day.body.id, categoryLevelId: levelId, encNotes: enc('felt tired', u.dek) })
      .expect(201);
    expect(dec(factor.body.encNotes, u.dek)).toBe('felt tired');

    // Show day nests its factors.
    const shown = await request(app).get(`/days/${day.body.id}`).set(auth(u.token)).expect(200);
    expect(shown.body.factors).toHaveLength(1);
    expect(dec(shown.body.factors[0].encNotes, u.dek)).toBe('felt tired');
  });

  it('stores day fields as opaque ciphertext at rest (no plaintext in the DB)', async () => {
    const u = await registerUser();
    const cycle = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    await request(app)
      .post('/days')
      .set(auth(u.token))
      .send({
        cycleId: cycle.body.id,
        encDate: enc('2026-01-02', u.dek),
        encNotes: enc('tender breasts', u.dek),
      })
      .expect(201);

    // Read the raw column straight from Postgres and assert no plaintext.
    const rows = await db.select({ encDate: days.encDate, encNotes: days.encNotes }).from(days);
    expect(rows).toHaveLength(1);
    const blob = Buffer.concat([rows[0]!.encDate, rows[0]!.encNotes!]);
    expect(blob).toBeInstanceOf(Buffer);
    expect(blob.toString('utf8')).not.toContain('2026-01-02');
    expect(blob.toString('utf8')).not.toContain('tender breasts');
  });

  it('updates and deletes a day', async () => {
    const u = await registerUser();
    const cycle = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    const day = await request(app)
      .post('/days')
      .set(auth(u.token))
      .send({ cycleId: cycle.body.id, encDate: enc('a', u.dek) })
      .expect(201);

    const updated = await request(app)
      .patch(`/days/${day.body.id}`)
      .set(auth(u.token))
      .send({ encNotes: enc('updated note', u.dek), order: 5 })
      .expect(200);
    expect(dec(updated.body.encNotes, u.dek)).toBe('updated note');
    expect(updated.body.order).toBe(5);

    await request(app).delete(`/days/${day.body.id}`).set(auth(u.token)).expect(204);
    await request(app).get(`/days/${day.body.id}`).set(auth(u.token)).expect(404);
  });

  it('filters cycles by id', async () => {
    const u = await registerUser();
    const c1 = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    await request(app).post('/cycles').set(auth(u.token)).expect(201);
    const res = await request(app)
      .get(`/cycles?filter[id]=${c1.body.id}`)
      .set(auth(u.token))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(c1.body.id);
  });
});

describe('authorization', () => {
  it("does not let a user read or delete another user's cycle (404, no existence leak)", async () => {
    const alice = await registerUser({ identifier: 'alice2' });
    const bob = await registerUser({ identifier: 'bob2' });
    const cycle = await request(app).post('/cycles').set(auth(alice.token)).expect(201);

    await request(app).get(`/cycles/${cycle.body.id}`).set(auth(bob.token)).expect(404);
    await request(app).delete(`/cycles/${cycle.body.id}`).set(auth(bob.token)).expect(404);
    // Owner still can.
    await request(app).get(`/cycles/${cycle.body.id}`).set(auth(alice.token)).expect(200);
  });

  it("cannot create a day in another user's cycle", async () => {
    const alice = await registerUser({ identifier: 'alice3' });
    const bob = await registerUser({ identifier: 'bob3' });
    const cycle = await request(app).post('/cycles').set(auth(alice.token)).expect(201);
    await request(app)
      .post('/days')
      .set(auth(bob.token))
      .send({
        cycleId: cycle.body.id,
        encDate: enc('x', bob.dek),
      })
      .expect(404);
  });

  it('exposes global categories to everyone but forbids non-admins from creating them', async () => {
    const u = await registerUser();
    const cats = await request(app).get('/categories').set(auth(u.token)).expect(200);
    expect(cats.body.length).toBe(GLOBAL_CATEGORY_COUNT);
    expect(cats.body.every((c: { global: boolean }) => c.global)).toBe(true);

    await request(app)
      .post('/categories')
      .set(auth(u.token))
      .send({ global: true, name: 'Hacked', icon: 'x', color: '#000' })
      .expect(403);
  });

  it('lets a user create an encrypted personal category and an admin a global one', async () => {
    const u = await registerUser();
    const personal = await request(app)
      .post('/categories')
      .set(auth(u.token))
      .send({ encName: enc('Cravings', u.dek), encColor: enc('#abcdef', u.dek) })
      .expect(201);
    expect(personal.body.global).toBe(false);
    expect(dec(personal.body.encName, u.dek)).toBe('Cravings');

    const admin = await registerUser({ identifier: 'admin1' });
    await makeAdmin(admin.userId);
    const global = await request(app)
      .post('/categories')
      .set(auth(admin.token))
      .send({ global: true, name: 'Temperature', icon: 'thermometer', color: '#00f' })
      .expect(201);
    expect(global.body.global).toBe(true);
    expect(global.body.name).toBe('Temperature');
  });

  it('rejects unknown body keys (strict validation)', async () => {
    const u = await registerUser();
    const cycle = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    await request(app)
      .post('/days')
      .set(auth(u.token))
      .send({
        cycleId: cycle.body.id,
        encDate: enc('a', u.dek),
        userId: 'sneaky',
      })
      .expect(400);
  });

  it("account deletion cascades to the user's data", async () => {
    const u = await registerUser();
    const cycle = await request(app).post('/cycles').set(auth(u.token)).expect(201);
    await request(app).delete(`/users/${u.userId}`).set(auth(u.token)).expect(204);
    // The token's user no longer exists.
    await request(app).get('/cycles').set(auth(u.token)).expect(401);
    // And the cycle is gone.
    const remaining = await db.execute(
      sql`SELECT count(*)::int AS n FROM cycles WHERE id = ${cycle.body.id}`,
    );
    expect((remaining.rows[0] as { n: number }).n).toBe(0);
  });
});
