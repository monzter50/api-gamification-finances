import { describe, it, expect, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../utils/crypto';
import { createSignedState, verifySignedState } from '../../utils/signedState';

const KEY = randomBytes(32);
const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('encryptSecret / decryptSecret (AES-256-GCM)', () => {
  it('round-trips and never stores the plaintext', () => {
    const enc = encryptSecret('1//refresh-token', 'user-1', KEY);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain('refresh-token');
    expect(decryptSecret(enc, 'user-1', KEY)).toBe('1//refresh-token');
  });

  it('uses a fresh IV every time', () => {
    expect(encryptSecret('same', 'user-1', KEY)).not.toBe(encryptSecret('same', 'user-1', KEY));
  });

  it('rejects a ciphertext moved onto another user (AAD binding)', () => {
    const enc = encryptSecret('token-of-user-1', 'user-1', KEY);
    expect(() => decryptSecret(enc, 'user-2', KEY)).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const [v, iv, tag, data] = encryptSecret('token', 'user-1', KEY).split('.') as [string, string, string, string];
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64url')].join('.'), 'user-1', KEY)).toThrow();
  });

  it('rejects a different key', () => {
    const enc = encryptSecret('token', 'user-1', KEY);
    expect(() => decryptSecret(enc, 'user-1', randomBytes(32))).toThrow();
  });

  it('requires a 32-byte TOKEN_ENCRYPTION_KEY', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => getEncryptionKey()).toThrow(/not configured/);
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString('base64');
    expect(() => getEncryptionKey()).toThrow(/32 bytes/);
    process.env.TOKEN_ENCRYPTION_KEY = KEY.toString('base64');
    expect(getEncryptionKey().equals(KEY)).toBe(true);
  });
});

describe('signed OAuth state', () => {
  const SECRET = 'state-test-secret-0123456789abcdef';
  const PURPOSE = 'google-sheets-connect';

  it('returns the user id for a valid state', () => {
    expect(verifySignedState(createSignedState('user-1', PURPOSE, SECRET), PURPOSE, SECRET)).toBe('user-1');
  });

  it('rejects an expired state', () => {
    const state = createSignedState('user-1', PURPOSE, SECRET, 600, Date.now() - 11 * 60_000);
    expect(verifySignedState(state, PURPOSE, SECRET)).toBeNull();
  });

  it('rejects a forged subject (payload swapped, signature kept)', () => {
    const [, sig] = createSignedState('attacker', PURPOSE, SECRET).split('.') as [string, string];
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'victim', purpose: PURPOSE, nonce: 'x', exp: 9_999_999_999 })).toString('base64url');
    expect(verifySignedState(`${forgedPayload}.${sig}`, PURPOSE, SECRET)).toBeNull();
  });

  it('rejects a state signed with another secret or for another purpose', () => {
    const state = createSignedState('user-1', PURPOSE, SECRET);
    expect(verifySignedState(state, PURPOSE, 'another-secret-0123456789abcdef')).toBeNull();
    expect(verifySignedState(state, 'something-else', SECRET)).toBeNull();
  });

  it('rejects garbage without throwing', () => {
    for (const junk of ['', 'abc', 'a.b.c', '..', '%%%.###']) {
      expect(verifySignedState(junk, PURPOSE, SECRET)).toBeNull();
    }
  });
});

describe('redactUrl', () => {
  it('masks OAuth secrets in logged URLs and leaves other params alone', async () => {
    const { redactUrl } = await import('../../utils/redactUrl');
    expect(redactUrl('/api/integrations/google/callback?code=4/0AbC&state=eyJ.sig&scope=x'))
      .toBe('/api/integrations/google/callback?code=%5BREDACTED%5D&state=%5BREDACTED%5D&scope=x');
    expect(redactUrl('/api/transactions?page=2&limit=10')).toBe('/api/transactions?page=2&limit=10');
    expect(redactUrl('/health')).toBe('/health');
  });
});
