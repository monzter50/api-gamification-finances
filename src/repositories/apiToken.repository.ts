import { type ApiToken, type User } from '@prisma/client';
import prisma from '../config/database';
import { BaseRepository } from './base.repository';

/** Only what `authenticate` needs about the owner — never the password hash. */
export type ApiTokenWithOwner = ApiToken & {
  user: Pick<User, 'id' | 'email' | 'name' | 'isActive'>
};

/**
 * "Active" = not revoked and not expired. Every query that lists or counts
 * usable tokens goes through this filter.
 */
const active = (now: Date): { revokedAt: null, expiresAt: { gt: Date } } => ({
  revokedAt: null,
  expiresAt: { gt: now }
});

/**
 * Typed queries are written longhand against `prisma.apiToken` (the base
 * class loses typing through its `prisma[modelName]` indirection).
 */
export class ApiTokenRepository extends BaseRepository<ApiToken> {
  constructor () {
    super('apiToken');
  }

  async createToken (data: {
    userId: string
    name: string
    tokenHash: string
    tokenPrefix: string
    scopes: string[]
    expiresAt: Date
  }): Promise<ApiToken> {
    return await prisma.apiToken.create({ data });
  }

  async listActiveByUser (userId: string, now: Date = new Date()): Promise<ApiToken[]> {
    return await prisma.apiToken.findMany({
      where: { userId, ...active(now) },
      orderBy: { createdAt: 'desc' }
    });
  }

  async countActiveByUser (userId: string, now: Date = new Date()): Promise<number> {
    return await prisma.apiToken.count({ where: { userId, ...active(now) } });
  }

  /** Lookup for authentication. Expiry/revocation are checked by the caller so it can tell them apart in logs. */
  async findByHashWithOwner (tokenHash: string): Promise<ApiTokenWithOwner | null> {
    return await prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, name: true, isActive: true } } }
    });
  }

  /** Scoped by userId: revoking someone else's token id is a no-op (→ 404 upstream). */
  async revokeByIdAndUser (id: string, userId: string, now: Date = new Date()): Promise<boolean> {
    const { count } = await prisma.apiToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: now }
    });
    return count > 0;
  }

  async touchLastUsed (id: string, now: Date = new Date()): Promise<void> {
    await prisma.apiToken.update({ where: { id }, data: { lastUsedAt: now } });
  }
}

export const apiTokenRepository = new ApiTokenRepository();
