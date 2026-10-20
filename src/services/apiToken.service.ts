import { type ApiToken } from '@prisma/client';
import { apiTokenRepository } from '../repositories/apiToken.repository';
import { generateApiToken, hashApiToken, isWellFormedApiToken } from '../utils/apiToken';
import { logger } from '../config/logger';
import { ApiTokenLimitReachedError, ApiTokenNotFoundError } from '../errors/DomainErrors';
import { AccountDeactivatedError, InvalidTokenError } from '../errors/AuthErrors';
import {
  API_TOKEN_SCOPES,
  type ApiTokenScope,
  type ApiTokenView,
  type CreateApiTokenInput,
  type CreatedApiTokenView
} from '../types/apiToken.types';

export const MAX_ACTIVE_TOKENS_PER_USER = 10;
export const DEFAULT_TOKEN_TTL_DAYS = 90;
export const MAX_TOKEN_TTL_DAYS = 365;
/** Bound the lastUsedAt write to ~once a minute per token. */
const LAST_USED_TOUCH_THROTTLE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ApiTokenPrincipal {
  userId: string
  email: string
  name: string
  apiTokenId: string
  scopes: ApiTokenScope[]
}

const normalizeScopes = (scopes: readonly string[]): ApiTokenScope[] => {
  const known = new Set(scopes.filter((s): s is ApiTokenScope => (API_TOKEN_SCOPES as readonly string[]).includes(s)));
  if (known.has('write')) known.add('read'); // write implies read
  return API_TOKEN_SCOPES.filter((s) => known.has(s));
};

const toView = (t: ApiToken): ApiTokenView => ({
  id: t.id,
  name: t.name,
  tokenPrefix: t.tokenPrefix,
  scopes: normalizeScopes(t.scopes),
  expiresAt: t.expiresAt,
  lastUsedAt: t.lastUsedAt,
  createdAt: t.createdAt
});

export class ApiTokenService {
  constructor (private readonly now: () => Date = () => new Date()) {}

  async create (userId: string, input: CreateApiTokenInput): Promise<CreatedApiTokenView> {
    const now = this.now();
    if (await apiTokenRepository.countActiveByUser(userId, now) >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new ApiTokenLimitReachedError(MAX_ACTIVE_TOKENS_PER_USER);
    }
    const days = Math.min(Math.max(input.expiresInDays ?? DEFAULT_TOKEN_TTL_DAYS, 1), MAX_TOKEN_TTL_DAYS);
    const { token, tokenHash, tokenPrefix } = generateApiToken();

    const saved = await apiTokenRepository.createToken({
      userId,
      name: input.name,
      tokenHash,
      tokenPrefix,
      scopes: normalizeScopes(input.scopes),
      expiresAt: new Date(now.getTime() + days * DAY_MS)
    });
    logger.info('API token created', { userId, apiTokenId: saved.id, scopes: saved.scopes });
    return { ...toView(saved), token };
  }

  async list (userId: string): Promise<ApiTokenView[]> {
    return (await apiTokenRepository.listActiveByUser(userId, this.now())).map(toView);
  }

  async revoke (userId: string, tokenId: string): Promise<void> {
    if (!await apiTokenRepository.revokeByIdAndUser(tokenId, userId, this.now())) {
      throw new ApiTokenNotFoundError();
    }
    logger.info('API token revoked', { userId, apiTokenId: tokenId });
  }

  /**
   * Resolve a raw `fpat_…` bearer to its owner. Every failure mode (malformed,
   * unknown, revoked, expired) is the same 401 to the client; the reason only
   * goes to the logs.
   */
  async authenticate (rawToken: string): Promise<ApiTokenPrincipal> {
    if (!isWellFormedApiToken(rawToken)) {
      throw new InvalidTokenError('Invalid API token');
    }
    const record = await apiTokenRepository.findByHashWithOwner(hashApiToken(rawToken));
    const now = this.now();
    const reason = record === null
      ? 'unknown'
      : record.revokedAt !== null
        ? 'revoked'
        : record.expiresAt <= now ? 'expired' : null;
    if (record === null || reason !== null) {
      logger.warn('API token rejected', { reason, apiTokenId: record?.id });
      throw new InvalidTokenError('Invalid API token');
    }
    if (!record.user.isActive) {
      throw new AccountDeactivatedError();
    }

    if (record.lastUsedAt === null || now.getTime() - record.lastUsedAt.getTime() > LAST_USED_TOUCH_THROTTLE_MS) {
      await apiTokenRepository.touchLastUsed(record.id, now);
    }

    return {
      userId: record.user.id,
      email: record.user.email,
      name: record.user.name,
      apiTokenId: record.id,
      scopes: normalizeScopes(record.scopes)
    };
  }
}

export const apiTokenService = new ApiTokenService();
