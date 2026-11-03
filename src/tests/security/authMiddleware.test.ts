import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authenticateJWT } from '../../middleware/auth';
import { isTokenBlacklisted } from '../../utils/tokenUtils';
import { userRepository } from '../../repositories/user.repository';

vi.mock('../../utils/tokenUtils', () => ({ isTokenBlacklisted: vi.fn() }));
vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findByIdWithoutPassword: vi.fn(), touchSessionActivity: vi.fn() }
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const SECRET = process.env.JWT_SECRET!; // set by tests/setup.ts
const sign = (payload: object, secret = SECRET, options: jwt.SignOptions = { algorithm: 'HS256' }): string =>
  jwt.sign({ userId: 'u1', id: 'u1', email: 'a@b.c', sid: 's1', ...payload }, secret, { expiresIn: '1h', ...options });

const call = async (authorization?: string): Promise<{ err: unknown, req: Request & { user?: unknown } }> => {
  const req = { headers: authorization !== undefined ? { authorization } : {} } as unknown as Request & { user?: unknown };
  let err: unknown = 'not-called';
  await authenticateJWT(req, {} as Response, (e?: unknown) => { err = e; });
  return { err, req };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
  vi.mocked(userRepository.findByIdWithoutPassword).mockResolvedValue({
    id: 'u1', isActive: true, sessionId: 's1', sessionLastActivityAt: new Date()
  } as never);
});

describe('authenticateJWT', () => {
  it('accepts a valid HS256 token for the current session', async () => {
    const { err, req } = await call(`Bearer ${sign({})}`);
    expect(err).toBeUndefined();
    expect(req.user).toMatchObject({ userId: 'u1', sid: 's1' });
  });

  it('401 UNAUTHORIZED without a Bearer header', async () => {
    expect((await call()).err).toMatchObject({ statusCode: 401, errorCode: 'UNAUTHORIZED' });
    expect((await call('Basic abc')).err).toMatchObject({ statusCode: 401, errorCode: 'UNAUTHORIZED' });
  });

  it('401 TOKEN_BLACKLISTED after logout', async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(true);
    expect((await call(`Bearer ${sign({})}`)).err).toMatchObject({ statusCode: 401, errorCode: 'TOKEN_BLACKLISTED' });
  });

  it('401 INVALID_TOKEN for a token signed with another secret (e.g. an old public default)', async () => {
    const forged = sign({}, 'your-secret-key');
    expect((await call(`Bearer ${forged}`)).err).toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOKEN' });
  });

  it('401 INVALID_TOKEN for an algorithm other than HS256', async () => {
    const hs512 = sign({}, SECRET, { algorithm: 'HS512' });
    expect((await call(`Bearer ${hs512}`)).err).toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOKEN' });
  });

  it('440 SESSION_REVOKED when a newer login superseded the token', async () => {
    const stale = sign({ sid: 'old-session' });
    expect((await call(`Bearer ${stale}`)).err).toMatchObject({ statusCode: 440, errorCode: 'SESSION_REVOKED' });
  });

  it('403 ACCOUNT_DEACTIVATED for a disabled user', async () => {
    vi.mocked(userRepository.findByIdWithoutPassword).mockResolvedValue({ id: 'u1', isActive: false, sessionId: 's1' } as never);
    expect((await call(`Bearer ${sign({})}`)).err).toMatchObject({ statusCode: 403, errorCode: 'ACCOUNT_DEACTIVATED' });
  });
});
