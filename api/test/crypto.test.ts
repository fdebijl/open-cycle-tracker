import { beforeAll, describe, expect, it } from 'vitest';
import * as crypto from '../src/crypto-client/index.js';

beforeAll(async () => {
  await crypto.ready();
});

describe('encryption contract (client envelope)', () => {
  const password = 'correct horse battery staple';

  it('round-trips the DEK through the password-wrapped envelope', () => {
    const env = crypto.buildSignupEnvelope(password);
    const dek = crypto.unwrapDek(
      password,
      env.payload.saltKek,
      env.payload.wrappedDek,
      env.payload.kdfParams,
    );
    expect(Buffer.from(dek)).toEqual(Buffer.from(env.dek));
  });

  it('round-trips the DEK through the recovery-code envelope', () => {
    const env = crypto.buildSignupEnvelope(password);
    const dek = crypto.unwrapDekWithRecovery(
      env.recoveryCode,
      env.payload.saltRecovery,
      env.payload.wrappedDekRecovery,
      env.payload.kdfParams,
    );
    expect(Buffer.from(dek)).toEqual(Buffer.from(env.dek));
  });

  it('derives the same authHash on login as at signup', () => {
    const env = crypto.buildSignupEnvelope(password);
    const loginAuthHash = crypto.deriveAuthHash(
      password,
      env.payload.saltAuth,
      env.payload.kdfParams,
    );
    expect(loginAuthHash).toEqual(env.payload.authHash);
  });

  it('rejects an unwrap with the wrong password', () => {
    const env = crypto.buildSignupEnvelope(password);
    expect(() =>
      crypto.unwrapDek(
        'wrong password',
        env.payload.saltKek,
        env.payload.wrappedDek,
        env.payload.kdfParams,
      ),
    ).toThrow();
  });

  it('round-trips field encryption with the DEK', () => {
    const env = crypto.buildSignupEnvelope(password);
    const blob = crypto.encryptField('2026-06-13', env.dek);
    expect(crypto.decryptField(blob, env.dek)).toBe('2026-06-13');
  });

  it('leaks no plaintext password or DEK into the signup payload', () => {
    const env = crypto.buildSignupEnvelope(password);
    const serialized = JSON.stringify(env.payload);
    expect(serialized).not.toContain(password);
    // The raw DEK bytes must never appear (check base64 and hex encodings).
    expect(serialized).not.toContain(Buffer.from(env.dek).toString('base64'));
    expect(serialized).not.toContain(Buffer.from(env.dek).toString('hex'));
  });
});
