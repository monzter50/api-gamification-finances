import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';

import { errorHandler } from '../../middleware/errorHandler';
import { BudgetNotFoundError } from '../../errors/DomainErrors';
import { InvalidCredentialsError } from '../../errors/AuthErrors';

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const run = (err: unknown): { status: number, body: Record<string, unknown> } => {
  const out = { status: 0, body: {} as Record<string, unknown> };
  const res = {
    status (code: number) { out.status = code; return this; },
    json (body: Record<string, unknown>) { out.body = body; return this; }
  } as unknown as Response;
  const req = { originalUrl: '/api/x', method: 'GET', ip: '127.0.0.1' } as unknown as Request;
  errorHandler(err as Error, req, res, vi.fn());
  return out;
};

const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = ORIGINAL_ENV; });

describe('errorHandler', () => {
  it('renders typed errors with their status and stable errorCode', () => {
    const { status, body } = run(new BudgetNotFoundError());
    expect(status).toBe(404);
    expect(body).toEqual({
      success: false,
      message: 'Budget not found',
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND'
    });
  });

  it('keeps legacy AuthError subclasses working', () => {
    const { status, body } = run(new InvalidCredentialsError());
    expect(status).toBe(401);
    expect(body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('hides internal messages and stacks outside development', () => {
    process.env.NODE_ENV = 'production';
    const { status, body } = run(new Error('relation "Account" does not exist at character 42'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('relation');
    expect(body).not.toHaveProperty('stack');
  });

  it('maps body-parser "payload too large" to 413 without leaking internals', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('request entity too large'), { status: 413, statusCode: 413, expose: true, type: 'entity.too.large' });
    const { status, body } = run(err);
    expect(status).toBe(413);
    expect(body.errorCode).toBe('PAYLOAD_TOO_LARGE');
  });

  it('does not echo non-exposable 4xx messages', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('secret internal detail'), { statusCode: 400, expose: false });
    const { status, body } = run(err);
    expect(status).toBe(400);
    expect(body.message).toBe('Bad request');
  });
});
