import { describe, it, expect, vi, beforeEach } from 'vitest';

const tx = {
  transaction: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  account: { update: vi.fn() }
};

vi.mock('../../config/database', () => ({
  default: { $transaction: async (fn: (client: typeof tx) => unknown) => await fn(tx) }
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../repositories/budget.repository', () => ({
  budgetRepository: { findById: vi.fn() }
}));
vi.mock('../../repositories/account.repository', () => ({
  accountRepository: { findByIdAndUser: vi.fn() }
}));
vi.mock('../../repositories/transaction.repository', () => ({
  transactionIncludes: {},
  transactionRepository: {
    findByIdAndUser: vi.fn(),
    getSpentCentsForExpenseItem: vi.fn(),
    getUsedCentsForIncomeItem: vi.fn()
  }
}));

import { transactionService } from '../../services/transaction.service';
import { budgetRepository } from '../../repositories/budget.repository';
import { accountRepository } from '../../repositories/account.repository';
import { transactionRepository } from '../../repositories/transaction.repository';

const USER = 'user-1';
// September fixture: Gas for Car — plan 5,000.00, real 5,201.29.
const budget = {
  id: 'budget-1',
  userId: USER,
  totalIncome: 40000,
  totalExpense: 5000,
  incomeItems: [{ id: 'inc-1', description: 'Salary', amount: 40000, amountCents: 4000000 }],
  expenseItems: [{ id: 'exp-gas', description: 'Gas for Car', amount: 5000, amountCents: 500000 }]
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(budgetRepository.findById).mockResolvedValue(budget as never);
  vi.mocked(accountRepository.findByIdAndUser).mockResolvedValue({ id: 'acc-1' } as never);
  tx.transaction.create.mockImplementation(async ({ data }) => ({ id: 'tx-1', ...data }));
  tx.transaction.update.mockImplementation(async ({ data }) => ({ id: 'tx-1', ...data }));
});

describe('TransactionService — overspend is recorded, not rejected (1.1)', () => {
  it('creates an expense that takes Gas for Car past its budget', async () => {
    vi.mocked(transactionRepository.getSpentCentsForExpenseItem).mockResolvedValue(480000);

    const created = await transactionService.createTransaction(USER, {
      budgetId: 'budget-1',
      date: '2026-09-18',
      amount: 401.29,
      vendor: 'Pemex',
      type: 'expense',
      accountId: 'acc-1',
      expenseItemId: 'exp-gas'
    });

    expect(created.id).toBe('tx-1');
    expect(tx.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 401.29, amountCents: 40129, expenseItemId: 'exp-gas' })
    }));
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: -401.29 }, balanceCents: { increment: -40129 } }
    });
  });

  it('still rejects an expense item that is not in the budget', async () => {
    await expect(transactionService.createTransaction(USER, {
      budgetId: 'budget-1',
      date: '2026-09-18',
      amount: 10,
      vendor: 'Pemex',
      type: 'expense',
      accountId: 'acc-1',
      expenseItemId: 'exp-other'
    })).rejects.toThrow('Expense item not found in this budget');
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('lets an update raise an expense above its budget', async () => {
    vi.mocked(transactionRepository.findByIdAndUser).mockResolvedValue({
      id: 'tx-1',
      userId: USER,
      budgetId: 'budget-1',
      accountId: 'acc-1',
      type: 'expense',
      amount: 100,
      amountCents: 10000,
      incomeItemId: null,
      expenseItemId: 'exp-gas'
    } as never);

    await transactionService.updateTransaction('tx-1', USER, { amount: 5201.29 });

    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { amount: 5201.29, amountCents: 520129 }
    }));
    expect(tx.account.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'acc-1' },
      data: { balance: { increment: 100 }, balanceCents: { increment: 10000 } }
    });
    expect(tx.account.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'acc-1' },
      data: { balance: { increment: -5201.29 }, balanceCents: { increment: -520129 } }
    });
  });

  it('keeps the hard limit on income items', async () => {
    vi.mocked(transactionRepository.getUsedCentsForIncomeItem).mockResolvedValue(4000000);

    await expect(transactionService.createTransaction(USER, {
      budgetId: 'budget-1',
      date: '2026-09-15',
      amount: 1,
      vendor: 'Employer',
      type: 'income',
      accountId: 'acc-1',
      incomeItemId: 'inc-1'
    })).rejects.toThrow(/exceeds remaining income balance/);
  });
});

describe('TransactionService.getBudgetBalance — status per line (1.1)', () => {
  it('reports Gas for Car as exceeded with a negative remaining', async () => {
    vi.mocked(transactionRepository.getSpentCentsForExpenseItem).mockResolvedValue(520129);
    vi.mocked(transactionRepository.getUsedCentsForIncomeItem).mockResolvedValue(0);

    const balance = await transactionService.getBudgetBalance('budget-1', USER);

    expect(balance.expenseBreakdown[0]).toMatchObject({
      description: 'Gas for Car',
      budgeted: 5000,
      spent: 5201.29,
      remaining: -201.29,
      status: 'exceeded'
    });
  });
});
