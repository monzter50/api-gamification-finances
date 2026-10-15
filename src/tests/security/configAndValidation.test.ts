import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request } from 'express';
import { validationResult } from 'express-validator';

import { assertRequiredEnv, getJwtSecret, isApiDocsEnabled } from '../../config/env';
import { registerValidation } from '../../validators/auth.validator';

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('config/env — fail fast, no secret defaults', () => {
  it('getJwtSecret throws instead of falling back to a default', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('assertRequiredEnv lists every missing variable', () => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    expect(() => { assertRequiredEnv(); }).toThrow('JWT_SECRET, DATABASE_URL');
  });

  it('API docs are off in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_API_DOCS;
    expect(isApiDocsEnabled()).toBe(false);
    process.env.ENABLE_API_DOCS = 'true';
    expect(isApiDocsEnabled()).toBe(true);
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_API_DOCS;
    expect(isApiDocsEnabled()).toBe(true);
  });
});

const runRegister = async (body: Record<string, unknown>): Promise<string[]> => {
  const req = { body } as unknown as Request;
  for (const chain of registerValidation) await chain.run(req);
  return validationResult(req).array().map((e) => (e.type === 'field' ? e.path : e.type));
};

describe('register password policy', () => {
  const base = { email: 'ana@example.com', name: 'Ana' };

  it('rejects passwords shorter than 8 characters', async () => {
    expect(await runRegister({ ...base, password: 'short7!' })).toContain('password');
  });

  it('accepts an 8+ character password and does not trim it', async () => {
    const req = { body: { ...base, password: '  spaced pass  ' } } as unknown as Request;
    for (const chain of registerValidation) await chain.run(req);
    expect(validationResult(req).isEmpty()).toBe(true);
    expect((req.body as { password: string }).password).toBe('  spaced pass  ');
  });

  it('rejects passwords over bcrypt\'s 72-byte limit', async () => {
    expect(await runRegister({ ...base, password: 'a'.repeat(73) })).toContain('password');
  });

  it('stores the name raw (no HTML escaping)', async () => {
    const req = { body: { ...base, password: 'longenough', name: 'Ana & Luis' } } as unknown as Request;
    for (const chain of registerValidation) await chain.run(req);
    expect((req.body as { name: string }).name).toBe('Ana & Luis');
  });
});
