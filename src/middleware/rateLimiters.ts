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
