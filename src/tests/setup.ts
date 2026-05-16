// Test setup file for Vitest
import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Force test environment defaults. These are dummy values — when integration
// tests start hitting Postgres, set DATABASE_URL via env.test or .env.test.local
// pointing at a dedicated test database (never reuse dev/staging/prod).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:postgres@localhost:5432/gamification_finances_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
