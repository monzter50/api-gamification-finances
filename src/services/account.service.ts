import { accountRepository } from '../repositories/account.repository';
import { type Account } from '@prisma/client';

export class AccountService {
  async getUserAccounts(userId: string): Promise<Account[]> {
    return accountRepository.findByUser(userId);
  }

  async getAccountById(id: string, userId: string): Promise<Account> {
    const account = await accountRepository.findByIdAndUser(id, userId);
    if (!account) {
      throw new Error('Account not found');
    }
    return account;
  }

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
    return accountRepository.createAccount(userId, data);
  }

  async updateAccount(
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Account> {
    const updated = await accountRepository.updateByIdAndUser(id, userId, data);
    if (!updated) {
      throw new Error('Account not found');
    }
    return updated;
  }

  async deleteAccount(id: string, userId: string): Promise<Account> {
    const hasTransactions = await accountRepository.hasTransactions(id);
    if (hasTransactions) {
      throw new Error('Cannot delete account with existing transactions');
    }

    const deleted = await accountRepository.deleteByIdAndUser(id, userId);
    if (!deleted) {
      throw new Error('Account not found');
    }
    return deleted;
  }
}

export const accountService = new AccountService();
