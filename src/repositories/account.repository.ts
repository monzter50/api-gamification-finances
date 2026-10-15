import { BaseRepository } from './base.repository';
import { type Account } from '@prisma/client';
import { toCents, fromCents } from '../utils/money';
import prisma from '../config/database';

/**
 * `balanceCents` is the source of truth. Serve `balance` derived from it so
 * API consumers never see drift from the legacy Float column.
 */
const withExactBalance = <T extends Account | null>(account: T): T =>
  account ? { ...account, balance: fromCents(account.balanceCents) } : account;

export class AccountRepository extends BaseRepository<Account> {
  constructor () {
    super('account');
  }

  /**
   * Find all accounts for a user
   */
  async findByUser (userId: string): Promise<Account[]> {
    const accounts: Account[] = await this.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return accounts.map(withExactBalance);
  }

  /**
   * Find account by ID and verify user ownership
   */
  async findByIdAndUser (id: string, userId: string): Promise<Account | null> {
    return withExactBalance(await this.model.findFirst({
      where: { id, userId }
    }));
  }

  /**
   * Create a new account for a user
   */
  async createAccount (
    userId: string,
    data: {
      name: string;
      type: string;
      balance?: number;
      currency?: string;
      isActive?: boolean;
    }
  ): Promise<Account> {
    const balanceCents = toCents(data.balance ?? 0);
    return this.model.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        balance: fromCents(balanceCents),
        balanceCents,
        currency: data.currency ?? 'MXN',
        isActive: data.isActive ?? true
      }
    });
  }

  /**
   * Update account by ID (only if belongs to user)
   */
  async updateByIdAndUser (
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'balanceCents'>>
  ): Promise<Account | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    // Whitelist the editable columns; a direct balance edit writes both money columns.
    const updateData: Partial<Account> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.balance !== undefined) {
      updateData.balanceCents = toCents(data.balance);
      updateData.balance = fromCents(updateData.balanceCents);
    }

    return withExactBalance(await this.model.update({
      where: { id },
      data: updateData
    }));
  }

  /**
   * Delete account by ID (only if belongs to user)
   */
  async deleteByIdAndUser (id: string, userId: string): Promise<Account | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    return withExactBalance(await this.model.delete({ where: { id } }));
  }

  /**
   * Of the given account IDs, return the ones owned by `userId` — one query
   * instead of one lookup per ID.
   */
  async findOwnedIds (ids: string[], userId: string): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await prisma.account.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true }
    });
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Check if account has transactions
   */
  async hasTransactions (id: string): Promise<boolean> {
    const count = await prisma.transaction.count({ where: { accountId: id } });
    return count > 0;
  }
}

export const accountRepository = new AccountRepository();
