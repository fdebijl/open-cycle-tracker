import { describe, expect, it } from 'vitest';
import {
  createDecoyVault,
  createSignup,
  deriveAuthHash,
  deriveRecoveryAuthHash,
  mnemonicToRecoveryCode,
  recoverDek,
  rewrapForPasswordChange,
  unwrapDek,
} from './envelope';
import { encryptString, decryptString } from './fields';
import { interactiveKdfParams } from './primitives';
import { mnemonicToSecret } from './codec';

// INTERACTIVE params keep these tests fast; production uses MODERATE.
const params = await interactiveKdfParams();

describe('signup envelope', () => {
  it('produces a payload the DEK can be unwrapped from with the password', async () => {
    const { payload, dek } = await createSignup('alice', 'correct horse battery staple', undefined, params);

    const recovered = await unwrapDek(
      'correct horse battery staple',
      payload.saltKek,
      payload.wrappedDek,
      payload.kdfParams,
    );
    expect(recovered).toEqual(dek);
  });

  it('derives an authHash at login that matches the one stored at signup', async () => {
    const { payload } = await createSignup('alice', 'hunter2hunter2', undefined, params);
    const loginAuthHash = await deriveAuthHash('hunter2hunter2', payload.saltAuth, payload.kdfParams);
    expect(loginAuthHash).toEqual(payload.authHash);
  });

  it('rejects the wrong password when unwrapping', async () => {
    const { payload } = await createSignup('alice', 'the right password', undefined, params);
    await expect(
      unwrapDek('the WRONG password', payload.saltKek, payload.wrappedDek, payload.kdfParams),
    ).rejects.toThrow();
  });

  it('contains NO plaintext password or DEK material - only opaque base64 blobs', async () => {
    const password = 'super-secret-password-1234';
    const { payload, dek } = await createSignup('alice', password, 'alice@example.com', params);

    const serialized = JSON.stringify(payload);
    // The password must never appear anywhere in what we send to the server.
    expect(serialized).not.toContain(password);
    // The raw DEK bytes must never appear either (check its base64 form).
    const { toBase64 } = await import('./codec');
    expect(serialized).not.toContain(await toBase64(dek));
    // Only the identifier and (opt-in) email are human-readable; everything
    // key-related is base64 of ciphertext/hashes.
    expect(payload.identifier).toBe('alice');
    expect(payload.email).toBe('alice@example.com');
  });

  it('omits email when not provided (pseudonymous signup)', async () => {
    const { payload } = await createSignup('anon', 'pw', undefined, params);
    expect(payload.email).toBeUndefined();
    expect('email' in payload).toBe(false);
  });
});

describe('recovery', () => {
  it('round-trips: a 24-word mnemonic recovers the same DEK', async () => {
    const { payload, dek, recoveryMnemonic } = await createSignup('alice', 'pw', undefined, params);
    expect(recoveryMnemonic.trim().split(/\s+/)).toHaveLength(24);

    const code = await mnemonicToRecoveryCode(recoveryMnemonic);
    const recovered = await recoverDek(code, payload.saltRecovery, payload.wrappedDekRecovery, payload.kdfParams);
    expect(recovered).toEqual(dek);

    // The recovery verifier is reproducible from the same mnemonic.
    const v1 = await deriveRecoveryAuthHash(code, payload.saltRecoveryAuth, payload.kdfParams);
    const v2 = await deriveRecoveryAuthHash(
      await mnemonicToRecoveryCode(recoveryMnemonic),
      payload.saltRecoveryAuth,
      payload.kdfParams,
    );
    expect(v1).toBe(v2);
  });

  it('rejects a mnemonic with a broken checksum', () => {
    expect(() => mnemonicToSecret('abandon abandon abandon')).toThrow();
  });
});

describe('password change', () => {
  it('re-wraps the same DEK under a new password without touching the data', async () => {
    const { payload, dek } = await createSignup('alice', 'old password', undefined, params);

    const changed = await rewrapForPasswordChange(dek, 'brand new password', payload.saltAuth, params);

    // Old password no longer unwraps the new envelope.
    await expect(
      unwrapDek('old password', changed.saltKek, changed.wrappedDek, changed.kdfParams),
    ).rejects.toThrow();

    // New password unwraps the identical DEK.
    const recovered = await unwrapDek('brand new password', changed.saltKek, changed.wrappedDek, changed.kdfParams);
    expect(recovered).toEqual(dek);

    expect(changed.authHash).not.toEqual(payload.authHash);
  });

  it('keeps saltAuth stable so duress/destruct verifiers survive the change', async () => {
    const { payload, dek } = await createSignup('alice', 'old password', undefined, params);
    const changed = await rewrapForPasswordChange(dek, 'brand new password', payload.saltAuth, params);

    // saltAuth is reused verbatim, and the new login authHash derives from it.
    expect(changed.saltAuth).toBe(payload.saltAuth);
    const loginAuthHash = await deriveAuthHash('brand new password', changed.saltAuth, changed.kdfParams);
    expect(loginAuthHash).toBe(changed.authHash);
  });
});

describe('decoy vault (duress)', () => {
  it('builds a decoy DEK that opens with the duress password but not the real one', async () => {
    const { payload } = await createSignup('alice', 'real password', undefined, params);

    const { shadow } = await createDecoyVault('duress password', payload.saltAuth, params);

    // The duress password unwraps the decoy DEK from the shadow envelope.
    const decoyDek = await unwrapDek('duress password', shadow.saltKek, shadow.wrappedDek, shadow.kdfParams);
    expect(decoyDek).toHaveLength(32);

    // The real password cannot open the decoy vault.
    await expect(
      unwrapDek('real password', shadow.saltKek, shadow.wrappedDek, shadow.kdfParams),
    ).rejects.toThrow();
  });

  it('derives the duress verifier from the PRIMARY saltAuth so login can match it', async () => {
    const { payload } = await createSignup('alice', 'real password', undefined, params);
    const { duressAuthHash } = await createDecoyVault('duress password', payload.saltAuth, params);

    // A duress login uses the primary's prelogin material; the authHash it derives
    // must equal the stored verifier.
    const loginAuthHash = await deriveAuthHash('duress password', payload.saltAuth, params);
    expect(loginAuthHash).toBe(duressAuthHash);

    // And it must NOT collide with the real password's verifier.
    expect(duressAuthHash).not.toBe(payload.authHash);
  });
});

describe('field encryption', () => {
  it('round-trips a string through the DEK', async () => {
    const { dek } = await createSignup('alice', 'pw', undefined, params);
    const blob = await encryptString('2026-06-13', dek);
    expect(blob).not.toContain('2026');
    expect(await decryptString(blob, dek)).toBe('2026-06-13');
  });

  it('produces a different blob each time (random nonce) but decrypts equally', async () => {
    const { dek } = await createSignup('alice', 'pw', undefined, params);
    const a = await encryptString('period', dek);
    const b = await encryptString('period', dek);
    expect(a).not.toEqual(b);
    expect(await decryptString(a, dek)).toBe('period');
    expect(await decryptString(b, dek)).toBe('period');
  });
});
