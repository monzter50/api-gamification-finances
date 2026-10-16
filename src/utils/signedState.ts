import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Short-lived, tamper-proof `state` values for OAuth redirects.
 *
 * The OAuth callback is a plain browser redirect (no Authorization header),
 * so the state is how we know WHICH user started the flow, and it stops
 * CSRF: an attacker can't forge a state for someone else's account.
 *
 * Format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`.
 * The HMAC key is derived from the given secret + a purpose string, so a
 * state can never be confused with a login JWT (different key, different
 * format) or with a state minted for another purpose.
 */

interface StatePayload {
  sub: string
  purpose: string
  nonce: string
  exp: number
}

const deriveKey = (secret: string, purpose: string): Buffer =>
  createHmac('sha256', secret).update(`signed-state:${purpose}`).digest();

const sign = (data: string, key: Buffer): string =>
  createHmac('sha256', key).update(data).digest('base64url');

export function createSignedState (
  subject: string,
  purpose: string,
  secret: string,
  ttlSeconds = 600,
  now: number = Date.now()
): string {
  const payload: StatePayload = {
    sub: subject,
    purpose,
    nonce: randomBytes(16).toString('base64url'),
    exp: Math.floor(now / 1000) + ttlSeconds
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${data}.${sign(data, deriveKey(secret, purpose))}`;
}

/** Returns the subject (userId) or null if the state is malformed, forged, expired or for another purpose. */
export function verifySignedState (
  state: string,
  purpose: string,
  secret: string,
  now: number = Date.now()
): string | null {
  const [data, signature, ...rest] = state.split('.');
  if (data === undefined || signature === undefined || rest.length > 0) return null;

  const expected = Buffer.from(sign(data, deriveKey(secret, purpose)), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let payload: Partial<StatePayload>;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Partial<StatePayload>;
  } catch {
    return null;
  }
  if (payload.purpose !== purpose || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp * 1000 < now) return null;
  return payload.sub;
}
