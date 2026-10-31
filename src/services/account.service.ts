import { accountRepository } from '../repositories/account.repository';
import { type Account } from '@prisma/client';
import { AccountNotFoundError, AccountHasTransactionsError } from '../errors/DomainErrors';

export class AccountService {
  async getUserAccounts (userId: string): Promise<Account[]> {
    return await accountRepository.findByUser(userId);
  }

  async getAccountById (id: string, userId: string): Promise<Account> {
    const account = await accountRepository.findByIdAndUser(id, userId);
    if (!account) {
      throw new AccountNotFoundError();
    }
    return account;
  }

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
    return await accountRepository.createAccount(userId, data);
  }

  async updateAccount (
    id: string,
    userId: string,
    data: Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'balanceCents'>>
  ): Promise<Account> {
    const updated = await accountRepository.updateByIdAndUser(id, userId, data);
    if (!updated) {
      throw new AccountNotFoundError();
    }
    return updated;
  }

  async deleteAccount (id: string, userId: string): Promise<Account> {
    // Ownership FIRST: checking "has transactions" before it would let a 409
    // confirm that another user's account ID exists.
    await this.getAccountById(id, userId);

    const hasTransactions = await accountRepository.hasTransactions(id);
    if (hasTransactions) {
      throw new AccountHasTransactionsError();
    }

    const deleted = await accountRepository.deleteByIdAndUser(id, userId);
    if (!deleted) {
      throw new AccountNotFoundError();
    }
    return deleted;
  }
}

export const accountService = new AccountService();
