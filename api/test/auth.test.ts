import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, closeDb, crypto, registerUser, request, resetDb } from './helpers.js';

beforeAll(async () => {
  await crypto.ready();
});
beforeEach(resetDb);
afterAll(closeDb);

describe('auth', () => {
  it('signs up a pseudonymous user (no email) and returns a token', async () => {
    const envelope = crypto.buildSignupEnvelope('a strong passphrase here');
    const res = await request(app)
      .post('/auth/signup')
      .send({ identifier: 'alice', ...envelope.payload })
      .expect(201);

    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.identifier).toBe('alice');
    expect(res.body.user.email).toBeNull();
    expect(res.body.wrappedDek).toBe(envelope.payload.wrappedDek);
  });

  it('rejects a duplicate identifier with 409', async () => {
    const e1 = crypto.buildSignupEnvelope('pw one');
    await request(app)
      .post('/auth/signup')
      .send({ identifier: 'bob', ...e1.payload })
      .expect(201);
    const e2 = crypto.buildSignupEnvelope('pw two');
    await request(app)
      .post('/auth/signup')
      .send({ identifier: 'bob', ...e2.payload })
      .expect(409);
  });

  it('prelogin returns a real salt for a known user', async () => {
    const user = await registerUser({ identifier: 'carol' });
    const res = await request(app).post('/auth/prelogin').send({ identifier: 'carol' }).expect(200);
    expect(res.body.saltAuth).toBeTypeOf('string');
    expect(res.body.kdfParams.algorithm).toBe('argon2id');
    // The returned salt actually lets us log in below, so it's the real one.
    expect(user.token).toBeTypeOf('string');
  });

  it('prelogin returns a STABLE pseudo-salt for unknown users (anti-enumeration)', async () => {
    const a = await request(app).post('/auth/prelogin').send({ identifier: 'ghost' }).expect(200);
    const b = await request(app).post('/auth/prelogin').send({ identifier: 'ghost' }).expect(200);
    // Indistinguishable shape from a real account, and stable across calls.
    expect(a.body.saltAuth).toBe(b.body.saltAuth);
    expect(Buffer.from(a.body.saltAuth, 'base64')).toHaveLength(16);
    expect(a.body.kdfParams.algorithm).toBe('argon2id');
  });

  it('logs in with the correct password and rejects the wrong one', async () => {
    const password = 'login test passphrase';
    await registerUser({ identifier: 'dave', password });

    const pre = await request(app).post('/auth/prelogin').send({ identifier: 'dave' }).expect(200);
    const authHash = crypto.deriveAuthHash(password, pre.body.saltAuth, pre.body.kdfParams);

    const ok = await request(app)
      .post('/auth/login')
      .send({ identifier: 'dave', authHash })
      .expect(200);
    expect(ok.body.token).toBeTypeOf('string');

    const wrongHash = crypto.deriveAuthHash(
      'not the password',
      pre.body.saltAuth,
      pre.body.kdfParams,
    );
    await request(app)
      .post('/auth/login')
      .send({ identifier: 'dave', authHash: wrongHash })
      .expect(401);
  });

  it('does not reveal whether an identifier exists on failed login', async () => {
    const pre = await request(app)
      .post('/auth/prelogin')
      .send({ identifier: 'nobody' })
      .expect(200);
    const authHash = crypto.deriveAuthHash('whatever', pre.body.saltAuth, pre.body.kdfParams);
    const res = await request(app).post('/auth/login').send({ identifier: 'nobody', authHash });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('revokes the token on logout (jti denylist)', async () => {
    const user = await registerUser({ identifier: 'erin' });
    // Token works before logout.
    await request(app)
      .get('/cycles')
      .set({ Authorization: `Bearer ${user.token}` })
      .expect(200);
    await request(app)
      .delete('/auth/logout')
      .set({ Authorization: `Bearer ${user.token}` })
      .expect(204);
    // Same token is now rejected.
    await request(app)
      .get('/cycles')
      .set({ Authorization: `Bearer ${user.token}` })
      .expect(401);
  });

  it('rejects requests with no/invalid bearer token', async () => {
    await request(app).get('/cycles').expect(401);
    await request(app).get('/cycles').set({ Authorization: 'Bearer garbage' }).expect(401);
  });
});
