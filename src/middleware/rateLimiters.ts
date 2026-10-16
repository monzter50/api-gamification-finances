import rateLimit from 'express-rate-limit';

/**
 * Rate limiters.
 *
 * The global `/api/` limiter lives in server.ts. Credential endpoints get an
 * extra, much stricter budget to slow down brute force and credential
 * stuffing. Successful logins don't count against it, so a real user who
 * signs in normally is never throttled.
 *
 * Buckets are per client IP — this relies on `TRUST_PROXY_HOPS` being set
 * correctly behind Railway (see server.ts).
 */
export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
    error: 'Too many attempts. Please try again later.',
    errorCode: 'TOO_MANY_ATTEMPTS'
  }
});

/**
 * Google Sheets sync: each run makes several Google API calls and counts
 * against the project's per-user Sheets quota (~60 writes/min). Keyed by the
 * authenticated user (mount AFTER authenticateJWT), not IP, so one user can't
 * burn the quota and users behind the same NAT don't share a bucket.
 */
export const googleSyncRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.GOOGLE_SYNC_RATE_LIMIT_MAX ?? '6', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${(req as typeof req & { user?: { userId?: string } }).user?.userId ?? 'anonymous'}`,
  message: {
    success: false,
    message: 'Too many syncs. Please wait a minute and try again.',
    error: 'Too many syncs. Please wait a minute and try again.',
    errorCode: 'TOO_MANY_SYNCS'
  }
});
