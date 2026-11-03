import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiTokenService, MAX_ACTIVE_TOKENS_PER_USER } from '../../services/apiToken.service';
import { apiTokenRepository } from '../../repositories/apiToken.repository';
import { hashApiToken, isWellFormedApiToken } from '../../utils/apiToken';
import { ApiTokenLimitReachedError, ApiTokenNotFoundError } from '../../errors/DomainErrors';

vi.mock('../../repositories/apiToken.repository', () => ({
  apiTokenRepository: {
    createToken: vi.fn(),
    listActiveByUser: vi.fn(),
    countActiveByUser: vi.fn(),
    revokeByIdAndUser: vi.fn()
  }
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const NOW = new Date('2026-10-20T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const service = new ApiTokenService(() => NOW);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiTokenRepository.countActiveByUser).mockResolvedValue(0);
  vi.mocked(apiTokenRepository.createToken).mockImplementation(async (data) => ({
    id: 'tok-1', lastUsedAt: null, revokedAt: null, createdAt: NOW, ...data
  }) as never);
});

describe('ApiTokenService.create', () => {
  it('returns the raw token once and stores only its SHA-256 hash', async () => {
    const created = await service.create('u1', { name: 'MCP', scopes: ['read'] });
    expect(isWellFormedApiToken(created.token)).toBe(true);

    const stored = vi.mocked(apiTokenRepository.createToken).mock.calls[0]![0];
    expect(stored.tokenHash).toBe(hashApiToken(created.token));
    expect(JSON.stringify(stored)).not.toContain(created.token);
    expect(stored.tokenPrefix).toBe(created.token.slice(0, 9));
    expect(created).not.toHaveProperty('tokenHash');
  });

  it('generates a different token every time', async () => {
    const a = await service.create('u1', { name: 'a', scopes: ['read'] });
    const b = await service.create('u1', { name: 'b', scopes: ['read'] });
    expect(a.token).not.toBe(b.token);
  });

  it('write implies read', async () => {
    const created = await service.create('u1', { name: 'MCP', scopes: ['write'] });
    expect(created.scopes).toEqual(['read', 'write']);
  });

  it('expires in 90 days by default, never more than 365', async () => {
    expect((await service.create('u1', { name: 'a', scopes: ['read'] })).expiresAt).toEqual(new Date(NOW.getTime() + 90 * DAY));
    expect((await service.create('u1', { name: 'b', scopes: ['read'], expiresInDays: 5000 })).expiresAt).toEqual(new Date(NOW.getTime() + 365 * DAY));
  });

  it(`refuses more than ${MAX_ACTIVE_TOKENS_PER_USER} active tokens`, async () => {
    vi.mocked(apiTokenRepository.countActiveByUser).mockResolvedValue(MAX_ACTIVE_TOKENS_PER_USER);
    await expect(service.create('u1', { name: 'x', scopes: ['read'] })).rejects.toBeInstanceOf(ApiTokenLimitReachedError);
    expect(apiTokenRepository.createToken).not.toHaveBeenCalled();
  });
});

describe('ApiTokenService.list / revoke', () => {
  it('never exposes the hash', async () => {
    vi.mocked(apiTokenRepository.listActiveByUser).mockResolvedValue([{
      id: 'tok-1', userId: 'u1', name: 'MCP', tokenHash: 'deadbeef', tokenPrefix: 'fpat_AbCd', scopes: ['read'], expiresAt: NOW, lastUsedAt: null, revokedAt: null, createdAt: NOW
    }]);
    const [view] = await service.list('u1');
    expect(view).not.toHaveProperty('tokenHash');
    expect(view).not.toHaveProperty('userId');
  });

  it('revokes only the caller\'s token; anything else is 404', async () => {
    vi.mocked(apiTokenRepository.revokeByIdAndUser).mockResolvedValue(false);
    await expect(service.revoke('u1', 'someone-elses-token')).rejects.toBeInstanceOf(ApiTokenNotFoundError);
    expect(apiTokenRepository.revokeByIdAndUser).toHaveBeenCalledWith('someone-elses-token', 'u1', NOW);
  });
});
