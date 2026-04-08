import { BaseRepository } from './base.repository';
import { type Account } from '@prisma/client';

export class AccountRepository extends BaseRepository<Account> {
  constructor() {
    super('account');
  }

  /**
   * Find all accounts for a user
   */
  async findByUser(userId: string): Promise<Account[]> {
    return this.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Find account by ID and verify user ownership
   */
  async findByIdAndUser(id: string, userId: string): Promise<Account | null> {
    return this.model.findFirst({
      where: { id, userId }
    });
  }

  /**
   * Create a new account for a user
   */
  async createAccount(
    userId: string,
    data: {
      name: string;
      type: string;
      balance?: number;
      currency?: string;
      isActive?: boolean;
    }
  ): Promise<Account> {
    return this.model.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
        currency: data.currency ?? 'MXN',
        isActive: data.isActive ?? true
      }
    });
  }

  /**
   * Update account by ID (only if belongs to user)
   */
  async updateByIdAndUser(
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Account | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    return this.model.update({
      where: { id },
      data
    });
  }

  /**
   * Delete account by ID (only if belongs to user)
   */
  async deleteByIdAndUser(id: string, userId: string): Promise<Account | null> {
    const exists = await this.model.findFirst({ where: { id, userId } });
    if (!exists) return null;

    return this.model.delete({ where: { id } });
  }

  /**
   * Check if account has transactions
   */
  async hasTransactions(id: string): Promise<boolean> {
    const count = await this.model.findFirst({
      where: { id },
      select: { _count: { select: { transactions: true } } }
    });
    return (count as any)?._count?.transactions > 0;
  }
}

export const accountRepository = new AccountRepository();
