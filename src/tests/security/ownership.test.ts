import { describe, it, expect, vi, beforeEach } from 'vitest';

import { transactionService } from '../../services/transaction.service';
import { budgetService } from '../../services/budget.service';
import { accountService } from '../../services/account.service';
import { budgetRepository } from '../../repositories/budget.repository';
import { accountRepository } from '../../repositories/account.repository';
import { transactionRepository } from '../../repositories/transaction.repository';
import {
  AccountNotFoundError,
  BudgetNotFoundError,
  InvalidAccountReferenceError,
  TransactionNotFoundError
} from '../../errors/DomainErrors';

vi.mock('../../config/database', () => ({ default: { $transaction: vi.fn() } }));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../repositories/budget.repository', () => ({
  budgetRepository: { findByIdAndUser: vi.fn(), findById: vi.fn(), findByUserAndPeriod: vi.fn() }
}));
vi.mock('../../repositories/account.repository', () => ({
  accountRepository: {
    findByIdAndUser: vi.fn(),
    findOwnedIds: vi.fn(),
    hasTransactions: vi.fn(),
    deleteByIdAndUser: vi.fn()
  }
}));
vi.mock('../../repositories/transaction.repository', () => ({
  transactionIncludes: {},
  transactionRepository: {
    findByIdAndUser: vi.fn(),
    getSpentCentsByExpenseItems: vi.fn(),
    getUsedCentsByIncomeItems: vi.fn()
  }
}));

const ATTACKER = 'user-b';

beforeEach(() => {
  vi.clearAllMocks();
  // Every owner-scoped lookup misses: the resources belong to someone else.
  vi.mocked(budgetRepository.findByIdAndUser).mockResolvedValue(null);
  vi.mocked(accountRepository.findByIdAndUser).mockResolvedValue(null);
  vi.mocked(accountRepository.findOwnedIds).mockResolvedValue(new Set());
  vi.mocked(transactionRepository.findByIdAndUser).mockResolvedValue(null);
});

describe('Another user\'s resources are indistinguishable from missing ones (404)', () => {
  it('budget: GET / balance / transaction create all raise BudgetNotFoundError', async () => {
    await expect(budgetService.getBudgetById('budget-a', ATTACKER)).rejects.toBeInstanceOf(BudgetNotFoundError);
    await expect(transactionService.getBudgetBalance('budget-a', ATTACKER)).rejects.toBeInstanceOf(BudgetNotFoundError);
    await expect(transactionService.createTransaction(ATTACKER, {
      budgetId: 'budget-a',
      date: '2026-09-01',
      amount: 10,
      vendor: 'x',
      type: 'expense',
      accountId: 'acc-a'
    })).rejects.toBeInstanceOf(BudgetNotFoundError);

    // Lookups are always scoped by the caller's id — never an unscoped findById.
    expect(budgetRepository.findByIdAndUser).toHaveBeenCalledWith('budget-a', ATTACKER);
    expect(budgetRepository.findById).not.toHaveBeenCalled();
  });

  it('budget not-owned maps to HTTP 404, not 403', async () => {
    const error = await budgetService.getBudgetById('budget-a', ATTACKER).catch((e: unknown) => e);
    expect(error).toMatchObject({ statusCode: 404, errorCode: 'BUDGET_NOT_FOUND' });
  });

  it('transaction: read/delete raise TransactionNotFoundError', async () => {
    await expect(transactionService.getTransactionById('tx-a', ATTACKER)).rejects.toBeInstanceOf(TransactionNotFoundError);
    await expect(transactionService.deleteTransaction('tx-a', ATTACKER)).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it('account delete checks ownership BEFORE "has transactions" (no 409 existence oracle)', async () => {
    vi.mocked(accountRepository.hasTransactions).mockResolvedValue(true);

    await expect(accountService.deleteAccount('acc-a', ATTACKER)).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(accountRepository.hasTransactions).not.toHaveBeenCalled();
    expect(accountRepository.deleteByIdAndUser).not.toHaveBeenCalled();
  });
});

describe('Foreign IDs referenced in the body are rejected (400)', () => {
  it('rejects a transaction that points at another user\'s account', async () => {
    vi.mocked(budgetRepository.findByIdAndUser).mockResolvedValue({
      id: 'budget-b', userId: ATTACKER, incomeItems: [], expenseItems: []
    } as never);

    const error = await transactionService.createTransaction(ATTACKER, {
      budgetId: 'budget-b',
      date: '2026-09-01',
      amount: 10,
      vendor: 'x',
      type: 'expense',
      accountId: 'acc-of-user-a'
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidAccountReferenceError);
    expect(error).toMatchObject({ statusCode: 400, errorCode: 'INVALID_ACCOUNT_REFERENCE' });
  });

  it('rejects a budget whose income items point at another user\'s account', async () => {
    vi.mocked(budgetRepository.findByIdAndUser).mockResolvedValue(null);

    await expect(budgetService.createBudget({
      userId: ATTACKER,
      year: 2026,
      month: 8,
      incomeItems: [{ description: 'Salary', amount: 100, type: 'Debit Card', accountId: 'acc-of-user-a' }]
    } as never)).rejects.toBeInstanceOf(InvalidAccountReferenceError);
  });
});
