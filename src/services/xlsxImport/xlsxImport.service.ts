import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { budgetRepository } from '../../repositories/budget.repository';
import { accountRepository } from '../../repositories/account.repository';
import { NoTransactionsFoundError, UnmappedPaymentSourceError } from '../../errors/XlsxImportErrors';
import { parseWorkbook } from './parser';
import {
  type ConfirmXlsxPayload,
  type ConfirmXlsxResult,
  type ParseResult,
  type ParsedTransaction
} from './types';

/**
 * Excel Import Service
 *
 * Maps the workbook to three entities and creates them atomically:
 *  - "Expenses" sheet → budget ExpenseItems
 *  - "Income"   sheet → budget IncomeItems (type + account chosen in the UI)
 *  - "Budget track"   → Transactions (income credits, expense debits the account)
 *
 * Standalone from TransactionService on purpose — owns its own `$transaction`.
 */
export class XlsxImportService {
  /** Step 1: parse the workbook (no DB writes). */
  async parse (buffer: Buffer): Promise<ParseResult> {
    const result = await parseWorkbook(buffer);
    const totalRows = result.counts.transactions + result.counts.incomeItems + result.counts.expenseItems;
    if (totalRows === 0) {
      throw new NoTransactionsFoundError('No transactions or budget items were found in the workbook.');
    }
    return result;
  }

  private resolveAccountId (row: ParsedTransaction, payload: ConfirmXlsxPayload): string {
    if (row.paymentSource) {
      const mapped = payload.accountMapping[row.paymentSource];
      if (!mapped) {
        throw new UnmappedPaymentSourceError(`No account mapped for "${row.paymentSource}"`);
      }
      return mapped;
    }
    return payload.defaultAccountId;
  }

  /** Step 2: atomically create expense items + income items + transactions. */
  async confirmImport (userId: string, payload: ConfirmXlsxPayload): Promise<ConfirmXlsxResult> {
    const { budgetId, transactions, incomeItems, expenseItems } = payload;

    // Verify the budget belongs to the user.
    const budget = await budgetRepository.findById(budgetId);
    if (!budget) { throw new Error('Budget not found'); }
    if (budget.userId !== userId) { throw new Error('Unauthorized access to budget'); }

    // Resolve transaction accounts and gather every account id we'll touch.
    const resolvedTx = transactions.map((row) => ({ row, accountId: this.resolveAccountId(row, payload) }));
    const accountIds = new Set<string>([
      ...resolvedTx.map((r) => r.accountId),
      ...incomeItems.map((i) => i.accountId)
    ]);
    for (const accountId of accountIds) {
      const account = await accountRepository.findByIdAndUser(accountId, userId);
      if (!account) {
        throw new Error(`Account ${accountId} not found or does not belong to user`);
      }
    }

    const transactionIds = await prisma.$transaction(async (tx) => {
      // Expense items (planning — no balance effect).
      for (const item of expenseItems) {
        await tx.expenseItem.create({
          data: { budgetId, description: item.description, amount: item.amount, type: item.type }
        });
      }

      // Income items (planning — no balance effect; carry the user's type + account).
      for (const item of incomeItems) {
        await tx.incomeItem.create({
          data: {
            budgetId,
            accountId: item.accountId,
            description: item.description,
            amount: item.amount,
            type: item.type
          }
        });
      }

      // Map of expense-item description → id (newly created + any pre-existing),
      // so each transaction can be linked to its expense item by Category.
      const budgetExpenseItems = await tx.expenseItem.findMany({
        where: { budgetId },
        select: { id: true, description: true }
      });
      const expenseItemByDescription = new Map(
        budgetExpenseItems.map((e) => [e.description.trim().toLowerCase(), e.id])
      );

      // Transactions (move the account balance: income +, expense −).
      const ids: string[] = [];
      for (const { row, accountId } of resolvedTx) {
        const delta = row.type === 'income' ? row.amount : -row.amount;
        const txData: any = {
          userId,
          budgetId,
          date: new Date(row.date),
          amount: row.amount,
          vendor: row.vendor,
          type: row.type,
          accountId
        };
        if (row.description !== undefined) { txData.description = row.description; }
        // Link expense transactions to their expense item via the sheet Category.
        if (row.type === 'expense' && row.category) {
          const expenseItemId = expenseItemByDescription.get(row.category.trim().toLowerCase());
          if (expenseItemId) { txData.expenseItemId = expenseItemId; }
        }

        const created = await tx.transaction.create({ data: txData });
        await tx.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } });
        ids.push(created.id);
      }
      return ids;
    });

    const createdCount = {
      transactions: transactionIds.length,
      incomeItems: incomeItems.length,
      expenseItems: expenseItems.length
    };
    logger.info(
      `Excel import for user ${userId}: ${createdCount.transactions} tx, ` +
      `${createdCount.incomeItems} income items, ${createdCount.expenseItems} expense items`
    );
    return { createdCount, transactionIds };
  }
}

export const xlsxImportService = new XlsxImportService();
