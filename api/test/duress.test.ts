import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, closeDb, crypto, registerUser, request, resetDb } from './helpers.js';

beforeAll(async () => {
  await crypto.ready();
});
beforeEach(resetDb);
afterAll(closeDb);

type Kdf = crypto.KdfParams;

async function prelogin(identifier: string): Promise<{ saltAuth: string; kdfParams: Kdf }> {
  const res = await request(app).post('/auth/prelogin').send({ identifier }).expect(200);
  return res.body;
}

/** Derive the login authHash and submit it, as a real client would. Returns the
 * resolved response (assert on `.status`/`.body`). */
async function attemptLogin(identifier: string, password: string) {
  const pre = await prelogin(identifier);
  const authHash = crypto.deriveAuthHash(password, pre.saltAuth, pre.kdfParams);
  return request(app).post('/auth/login').send({ identifier, authHash });
}

/** attemptLogin + status assertion, returning the response. */
async function login(identifier: string, password: string, status: number) {
  const res = await attemptLogin(identifier, password);
  expect(res.status).toBe(status);
  return res;
}

/** Build the body the UI's `createDecoyVault` produces for POST /auth/duress. */
function buildDecoy(duressPassword: string, primarySaltAuth: string, kdfParams: Kdf) {
  const shadow = crypto.buildSignupEnvelope(duressPassword, kdfParams);
  const duressAuthHash = crypto.deriveAuthHash(duressPassword, primarySaltAuth, kdfParams);
  return { decoyDek: shadow.dek, body: { duressAuthHash, shadow: shadow.payload } };
}

describe('duress / decoy passwords (roadmap #14)', () => {
  it('configures a decoy and the real password still logs in normally', async () => {
    const user = await registerUser({ identifier: 'alice' });
    const pre = await prelogin('alice');
    const { body } = buildDecoy('decoy-pass', pre.saltAuth, pre.kdfParams);

    await request(app).post('/auth/duress').set(auth(user.token)).send({ duress: body }).expect(204);

    const res = await login('alice', user.password, 200);
    expect(res.body.user.id).toBe(user.userId);
  });

  it('opens a SEPARATE, empty decoy vault for the duress password', async () => {
    const user = await registerUser({ identifier: 'bea' });
    // Real data exists in the real vault.
    await request(app).post('/cycles').set(auth(user.token)).send({}).expect(201);

    const pre = await prelogin('bea');
    const { decoyDek, body } = buildDecoy('decoy-pass', pre.saltAuth, pre.kdfParams);
    await request(app).post('/auth/duress').set(auth(user.token)).send({ duress: body }).expect(204);

    // The duress password logs into a DIFFERENT user (the shadow), and its key
    // material unwraps the decoy DEK (not the real one).
    const duress = await login('bea', 'decoy-pass', 200);
    expect(duress.body.user.id).not.toBe(user.userId);
    const dek = crypto.unwrapDek('decoy-pass', duress.body.saltKek, duress.body.wrappedDek, duress.body.kdfParams);
    expect(Buffer.from(dek)).toEqual(Buffer.from(decoyDek));

    // The decoy session sees NONE of the real data (per-user scoping).
    const decoyCycles = await request(app).get('/cycles').set(auth(duress.body.token)).expect(200);
    expect(decoyCycles.body).toHaveLength(0);

    // The real session is untouched.
    const real = await login('bea', user.password, 200);
    const realCycles = await request(app).get('/cycles').set(auth(real.body.token)).expect(200);
    expect(realCycles.body).toHaveLength(1);
  });

  it('persists decoy data across duress logins, invisible to the real vault', async () => {
    const user = await registerUser({ identifier: 'cleo' });
    const pre = await prelogin('cleo');
    const { body } = buildDecoy('decoy-pass', pre.saltAuth, pre.kdfParams);
    await request(app).post('/auth/duress').set(auth(user.token)).send({ duress: body }).expect(204);

    const first = await login('cleo', 'decoy-pass', 200);
    await request(app).post('/cycles').set(auth(first.body.token)).send({}).expect(201);

    const second = await login('cleo', 'decoy-pass', 200);
    const decoyCycles = await request(app).get('/cycles').set(auth(second.body.token)).expect(200);
    expect(decoyCycles.body).toHaveLength(1);

    const real = await login('cleo', user.password, 200);
    const realCycles = await request(app).get('/cycles').set(auth(real.body.token)).expect(200);
    expect(realCycles.body).toHaveLength(0);
  });

  it('the destruction password wipes the account and fails like a wrong password', async () => {
    const user = await registerUser({ identifier: 'dora' });
    const pre = await prelogin('dora');
    const destructAuthHash = crypto.deriveAuthHash('boom', pre.saltAuth, pre.kdfParams);
    await request(app).post('/auth/duress').set(auth(user.token)).send({ destructAuthHash }).expect(204);

    // Entering it returns the same generic 401 as any wrong password...
    await login('dora', 'boom', 401);

    // ...but the account is gone: the real password no longer works, and the
    // identifier reads as unknown (prelogin returns an anti-enumeration salt).
    await login('dora', user.password, 401);
  });

  it('the destruction password also wipes the decoy vault', async () => {
    const user = await registerUser({ identifier: 'eve' });
    const pre = await prelogin('eve');
    const { body } = buildDecoy('decoy-pass', pre.saltAuth, pre.kdfParams);
    const destructAuthHash = crypto.deriveAuthHash('boom', pre.saltAuth, pre.kdfParams);
    await request(app)
      .post('/auth/duress')
      .set(auth(user.token))
      .send({ duress: body, destructAuthHash })
      .expect(204);

    // The decoy is reachable before the wipe.
    await login('eve', 'decoy-pass', 200);

    await login('eve', 'boom', 401);

    // Both the real and the decoy login are now dead.
    await login('eve', user.password, 401);
    await login('eve', 'decoy-pass', 401);
  });

  it('keeps the decoy working after a password change (stable saltAuth)', async () => {
    const user = await registerUser({ identifier: 'fern' });
    const pre = await prelogin('fern');
    const { body } = buildDecoy('decoy-pass', pre.saltAuth, pre.kdfParams);
    await request(app).post('/auth/duress').set(auth(user.token)).send({ duress: body }).expect(204);

    // Change the real password REUSING the existing saltAuth (what the UI does),
    // so the duress verifier - derived from that same saltAuth - keeps matching.
    const newPassword = 'a fresh real password';
    const newSaltKek = crypto.randomSalt();
    const changeBody = {
      authHash: crypto.deriveAuthHash(newPassword, pre.saltAuth, pre.kdfParams),
      saltAuth: pre.saltAuth,
      saltKek: crypto._internal.b64(newSaltKek),
      wrappedDek: crypto._internal.b64(crypto.seal(user.dek, crypto.deriveKey(newPassword, newSaltKek, pre.kdfParams))),
      kdfParams: pre.kdfParams,
    };
    await request(app).post('/auth/password').set(auth(user.token)).send(changeBody).expect(204);

    // New real password works, old one doesn't, and the decoy still opens.
    await login('fern', newPassword, 200);
    await login('fern', user.password, 401);
    await login('fern', 'decoy-pass', 200);
  });

  it('rejects an unauthenticated attempt to configure duress', async () => {
    await request(app).post('/auth/duress').send({ destructAuthHash: 'x'.repeat(43) + '=' }).expect(401);
  });
});
