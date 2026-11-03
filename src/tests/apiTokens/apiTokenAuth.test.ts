import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authenticateJWT, authenticateUserOrApiToken } from '../../middleware/auth';
import { apiTokenRepository } from '../../repositories/apiToken.repository';
import { userRepository } from '../../repositories/user.repository';
import { isTokenBlacklisted } from '../../utils/tokenUtils';
import { generateApiToken } from '../../utils/apiToken';

vi.mock('../../utils/tokenUtils', () => ({ isTokenBlacklisted: vi.fn() }));
vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findByIdWithoutPassword: vi.fn(), touchSessionActivity: vi.fn() }
}));
vi.mock('../../repositories/apiToken.repository', () => ({
  apiTokenRepository: { findByHashWithOwner: vi.fn(), touchLastUsed: vi.fn() }
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const { token: RAW, tokenHash } = generateApiToken();
const DAY = 24 * 60 * 60 * 1000;

const record = (over: Record<string, unknown> = {}): unknown => ({
  id: 'tok-1',
  userId: 'u1',
  name: 'MCP',
  tokenHash,
  tokenPrefix: RAW.slice(0, 9),
  scopes: ['read'],
  expiresAt: new Date(Date.now() + 30 * DAY),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date(),
  user: { id: 'u1', email: 'a@b.c', name: 'Ana', isActive: true },
  ...over
});

type Mw = typeof authenticateJWT;
const call = async (mw: Mw, method: string, authorization?: string): Promise<{ err: unknown, req: Request & { user?: unknown } }> => {
  const req = { method, headers: authorization !== undefined ? { authorization } : {} } as unknown as Request & { user?: unknown };
  let err: unknown = 'not-called';
  await mw(req, {} as Response, (e?: unknown) => { err = e; });
  return { err, req };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
  vi.mocked(apiTokenRepository.findByHashWithOwner).mockResolvedValue(record() as never);
});

describe('authenticateUserOrApiToken — personal API tokens', () => {
  it('accepts a valid read token on GET and identifies the owner', async () => {
    const { err, req } = await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`);
    expect(err).toBeUndefined();
    expect(req.user).toMatchObject({ userId: 'u1', authMethod: 'api_token', apiTokenId: 'tok-1', scopes: ['read'] });
    // Looked up by hash — the raw token never reaches the database.
    expect(apiTokenRepository.findByHashWithOwner).toHaveBeenCalledWith(tokenHash);
  });

  it('403 INSUFFICIENT_SCOPE when a read token tries to write', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect((await call(authenticateUserOrApiToken, method, `Bearer ${RAW}`)).err)
        .toMatchObject({ statusCode: 403, errorCode: 'INSUFFICIENT_SCOPE' });
    }
  });

  it('a write token can read and write', async () => {
    vi.mocked(apiTokenRepository.findByHashWithOwner).mockResolvedValue(record({ scopes: ['write'] }) as never);
    expect((await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`)).err).toBeUndefined();
    expect((await call(authenticateUserOrApiToken, 'DELETE', `Bearer ${RAW}`)).err).toBeUndefined();
  });

  it('401 INVALID_TOKEN for unknown, revoked and expired tokens (same answer for all)', async () => {
    const cases = [null, record({ revokedAt: new Date() }), record({ expiresAt: new Date(Date.now() - 1000) })];
    for (const found of cases) {
      vi.mocked(apiTokenRepository.findByHashWithOwner).mockResolvedValue(found as never);
      expect((await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`)).err)
        .toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOKEN', message: 'Invalid API token' });
    }
  });

  it('rejects malformed fpat_ tokens without a database lookup', async () => {
    for (const bad of ['fpat_', 'fpat_short', `${RAW}x`, `${RAW.slice(0, -1)}!`]) {
      expect((await call(authenticateUserOrApiToken, 'GET', `Bearer ${bad}`)).err)
        .toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOKEN' });
    }
    expect(apiTokenRepository.findByHashWithOwner).not.toHaveBeenCalled();
  });

  it('403 ACCOUNT_DEACTIVATED when the owner is disabled', async () => {
    vi.mocked(apiTokenRepository.findByHashWithOwner).mockResolvedValue(record({ user: { id: 'u1', email: 'a@b.c', name: 'Ana', isActive: false } }) as never);
    expect((await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`)).err)
      .toMatchObject({ statusCode: 403, errorCode: 'ACCOUNT_DEACTIVATED' });
  });

  it('never touches the web session (no SESSION_ALREADY_ACTIVE / 440 side effects)', async () => {
    await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`);
    expect(userRepository.findByIdWithoutPassword).not.toHaveBeenCalled();
    expect(userRepository.touchSessionActivity).not.toHaveBeenCalled();
    expect(isTokenBlacklisted).not.toHaveBeenCalled();
  });

  it('records lastUsedAt, at most about once a minute', async () => {
    await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`);
    expect(apiTokenRepository.touchLastUsed).toHaveBeenCalledOnce();

    vi.mocked(apiTokenRepository.touchLastUsed).mockClear();
    vi.mocked(apiTokenRepository.findByHashWithOwner).mockResolvedValue(record({ lastUsedAt: new Date(Date.now() - 5000) }) as never);
    await call(authenticateUserOrApiToken, 'GET', `Bearer ${RAW}`);
    expect(apiTokenRepository.touchLastUsed).not.toHaveBeenCalled();
  });

  it('still accepts a normal app session JWT', async () => {
    vi.mocked(userRepository.findByIdWithoutPassword).mockResolvedValue({ id: 'u1', isActive: true, sessionId: 's1', sessionLastActivityAt: new Date() } as never);
    const jwtToken = jwt.sign({ userId: 'u1', id: 'u1', email: 'a@b.c', name: 'Ana', sid: 's1' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' });
    const { err, req } = await call(authenticateUserOrApiToken, 'POST', `Bearer ${jwtToken}`);
    expect(err).toBeUndefined();
    expect(req.user).toMatchObject({ userId: 'u1', authMethod: 'session', sid: 's1' });
  });
});

describe('authenticateJWT — session-only endpoints', () => {
  it('403 API_TOKEN_NOT_ALLOWED for an API token, before any lookup', async () => {
    expect((await call(authenticateJWT, 'GET', `Bearer ${RAW}`)).err)
      .toMatchObject({ statusCode: 403, errorCode: 'API_TOKEN_NOT_ALLOWED' });
    expect(apiTokenRepository.findByHashWithOwner).not.toHaveBeenCalled();
  });
});
