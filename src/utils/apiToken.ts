import { createHash, randomBytes } from 'crypto';

/**
 * Personal API token format: `fpat_` + 32 random bytes (base64url, 43 chars).
 *
 * - The fixed prefix lets the auth middleware route the token without trying
 *   to parse it as a JWT, and lets secret scanners (gitleaks) recognize it.
 * - 256 bits of entropy → a plain SHA-256 is the right storage hash (like
 *   GitHub tokens). bcrypt would only add latency: there's nothing to brute force.
 */
export const API_TOKEN_PREFIX = 'fpat_';
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^fpat_[A-Za-z0-9_-]{43}$/;
/** How many characters of the token we keep in clear for display ("fpat_AbCd"). */
const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 4;

export interface GeneratedApiToken {
  /** Shown to the user exactly once. Never stored, never logged. */
  token: string
  tokenHash: string
  tokenPrefix: string
}

export const hashApiToken = (raw: string): string =>
  createHash('sha256').update(raw, 'utf8').digest('hex');

/** Cheap routing check: "this bearer is meant to be an API token, not a JWT". */
export const looksLikeApiToken = (raw: string): boolean => raw.startsWith(API_TOKEN_PREFIX);

/** Full shape check, done before touching the database. */
export const isWellFormedApiToken = (raw: string): boolean => TOKEN_PATTERN.test(raw);

export function generateApiToken (): GeneratedApiToken {
  const token = API_TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashApiToken(token), tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH) };
}
