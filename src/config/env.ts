import { logger } from './logger';
import { getEncryptionKey } from '../utils/crypto';

/**
 * Centralized access to security-relevant configuration.
 *
 * Secrets have NO defaults: a deploy that forgets `JWT_SECRET` must fail to
 * start, not silently sign tokens with a string that is public in this repo.
 */

/** Only HS256 is accepted — pinning the algorithm blocks alg-confusion tricks. */
export const JWT_ALGORITHM = 'HS256' as const;

const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const;

/** Minimum secret length we accept without a warning (32 bytes ≈ 256 bits). */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validate required env vars once at startup. Throws (and the server exits)
 * listing every missing variable, so a misconfigured deploy fails loudly.
 */
export function assertRequiredEnv (): void {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
  const secret = process.env.JWT_SECRET!;
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    logger.warn(`⚠️  JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters — use a long random value (e.g. \`openssl rand -base64 48\`).`);
  }
  assertGoogleConfig();
}

/** The JWT signing secret. Throws if unset — never falls back to a default. */
export function getJwtSecret (): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function getJwtExpiresIn (): string {
  return process.env.JWT_EXPIRES_IN ?? '7d';
}

/**
 * Whether Swagger UI, the raw OpenAPI spec and `/api/docs` are served.
 * Defaults to on outside production, off in production; override with
 * `ENABLE_API_DOCS=true|false`.
 */
export function isApiDocsEnabled (): boolean {
  const flag = process.env.ENABLE_API_DOCS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

// ---- Google Sheets export (optional feature) -------------------------------

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  /** Must exactly match an authorized redirect URI in Google Cloud. */
  redirectUri: string
  /** Where the browser lands after the OAuth callback (fixed — never from the request). */
  frontendUrl: string
}

const GOOGLE_VARS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'FRONTEND_URL'] as const;

/**
 * The Google integration is optional. It's ON when GOOGLE_CLIENT_ID is set;
 * then every related variable — and a valid TOKEN_ENCRYPTION_KEY — must be
 * present, or the server refuses to start (half-configured is worse than off).
 */
function assertGoogleConfig (): void {
  if (!process.env.GOOGLE_CLIENT_ID) return;
  const missing = GOOGLE_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Google integration is enabled (GOOGLE_CLIENT_ID is set) but these are missing: ${missing.join(', ')}`);
  }
  getEncryptionKey(); // throws with a clear message if missing or not 32 bytes
}

/** Google OAuth settings, or null when the integration isn't configured. */
export function getGoogleOAuthConfig (): GoogleOAuthConfig | null {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !FRONTEND_URL) return null;
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
    frontendUrl: FRONTEND_URL.replace(/\/+$/, '')
  };
}
