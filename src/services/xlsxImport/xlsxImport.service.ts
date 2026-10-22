import { type Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { budgetRepository } from '../../repositories/budget.repository';
import { accountRepository } from '../../repositories/account.repository';
import { BudgetNotFoundError, InvalidAccountReferenceError } from '../../errors/DomainErrors';
import { NoTransactionsFoundError, UnmappedPaymentSourceError } from '../../errors/XlsxImportErrors';
import { toCents, fromCents } from '../../utils/money';
import { balanceDeltaCents, balanceIncrement } from '../ledgerRules';
import { parseWorkbook } from './parser';
import {
  computeImportHashes,
  findUnmatchedCategories,
  matchLegacyRows,
  normalizeKey,
  type LedgerIdentityRow
} from './dedupe';
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
 * Standalone from TransactionService on purpose — owns its own `$transaction`
 * — but it applies the same ledger rules (`ledgerRules`): money in cents, the
 * same balance delta per type, and no spending limit (overspend is a status).
 *
 * Confirming is idempotent: items are upserted by name within the budget and
 * transactions carry an `importHash`, so re-importing a workbook updates the
 * plan and skips rows that are already in the ledger.
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

  /**
   * Hash-less rows of this user inside the payload's date range — the only
   * ones that can match. Bounded by date so it never scans the whole ledger.
   */
  private async findLegacyCandidates (userId: string, rows: ParsedTransaction[]): Promise<LedgerIdentityRow[]> {
    const days = rows.map((row) => row.date.slice(0, 10)).filter((day) => day !== '').sort();
    if (days.length === 0) { return []; }
    const from = new Date(`${days[0]!}T00:00:00.000Z`);
    const until = new Date(`${days[days.length - 1]!}T00:00:00.000Z`);
    until.setUTCDate(until.getUTCDate() + 1);
    return await prisma.transaction.findMany({
      where: { userId, importHash: null, date: { gte: from, lt: until } },
      select: { id: true, date: true, amountCents: true, vendor: true, type: true, createdAt: true }
    });
  }

  /** Step 2: atomically create expense items + income items + transactions. */
  async confirmImport (userId: string, payload: ConfirmXlsxPayload): Promise<ConfirmXlsxResult> {
    const { budgetId, transactions, incomeItems, expenseItems } = payload;

    // Verify the budget belongs to the user.
    const budget = await budgetRepository.findByIdAndUser(budgetId, userId);
    if (!budget) { throw new BudgetNotFoundError(); }

    // Resolve transaction accounts and gather every account id we'll touch.
    const resolvedTx = transactions.map((row) => ({ row, accountId: this.resolveAccountId(row, payload) }));
    const accountIds = new Set<string>([
      ...resolvedTx.map((r) => r.accountId),
      ...incomeItems.map((i) => i.accountId)
    ]);
    const owned = await accountRepository.findOwnedIds([...accountIds], userId);
    const foreign = [...accountIds].find((accountId) => !owned.has(accountId));
    if (foreign !== undefined) {
      throw new InvalidAccountReferenceError(foreign);
    }

    // Idempotency: one stable hash per row; rows already imported are skipped.
    const hashes = computeImportHashes(transactions);
    const alreadyImported = new Set(
      (await prisma.transaction.findMany({
        where: { userId, importHash: { in: hashes } },
        select: { importHash: true }
      })).map((t) => t.importHash)
    );

    // Legacy rows (written before importHash existed) are invisible to the
    // hash check. Match them by natural key so a re-import doesn't duplicate
    // them, and let them adopt the hash so the next import takes the fast path.
    const legacyMatches = matchLegacyRows(
      transactions,
      await this.findLegacyCandidates(userId, transactions),
      (index) => !alreadyImported.has(hashes[index]!)
    );

    const outcome = await prisma.$transaction(async (tx) => {
      const updatedCount = { incomeItems: 0, expenseItems: 0 };
      const createdItems = { incomeItems: 0, expenseItems: 0 };

      // Expense items (planning — no balance effect). Upsert by name so a
      // re-import refreshes the plan instead of duplicating every line.
      const expenseItemByDescription = new Map(
        (await tx.expenseItem.findMany({ where: { budgetId }, select: { id: true, description: true } }))
          .map((e) => [normalizeKey(e.description), e.id])
      );
      for (const item of expenseItems) {
        const key = normalizeKey(item.description);
        const amountCents = toCents(item.amount);
        const money = { amount: fromCents(amountCents), amountCents };
        const existingId = expenseItemByDescription.get(key);
        if (existingId) {
          await tx.expenseItem.update({ where: { id: existingId }, data: { ...money, type: item.type } });
          updatedCount.expenseItems++;
        } else {
          const created = await tx.expenseItem.create({
            data: { budgetId, description: item.description, type: item.type, ...money }
          });
          expenseItemByDescription.set(key, created.id);
          createdItems.expenseItems++;
        }
      }

      // Income items (planning — no balance effect; carry the user's type + account).
      const incomeItemByDescription = new Map(
        (await tx.incomeItem.findMany({ where: { budgetId }, select: { id: true, description: true } }))
          .map((i) => [normalizeKey(i.description), i.id])
      );
      for (const item of incomeItems) {
        const key = normalizeKey(item.description);
        const amountCents = toCents(item.amount);
        const data = { accountId: item.accountId, type: item.type, amount: fromCents(amountCents), amountCents };
        const existingId = incomeItemByDescription.get(key);
        if (existingId) {
          await tx.incomeItem.update({ where: { id: existingId }, data });
          updatedCount.incomeItems++;
        } else {
          const created = await tx.incomeItem.create({
            data: { budgetId, description: item.description, ...data }
          });
          incomeItemByDescription.set(key, created.id);
          createdItems.incomeItems++;
        }
      }

      // Transactions (move the account balance: income +, expense −).
      const ids: string[] = [];
      let skipped = 0;
      let adoptedLegacy = 0;
      for (const [index, { row, accountId }] of resolvedTx.entries()) {
        const importHash = hashes[index]!;
        if (alreadyImported.has(importHash)) { skipped++; continue; }

        const legacyId = legacyMatches[index];
        if (legacyId) {
          // Already in the ledger (and already counted in the balance): only
          // stamp it with its identity, no money moves.
          await tx.transaction.update({ where: { id: legacyId }, data: { importHash } });
          skipped++;
          adoptedLegacy++;
          continue;
        }

        const amountCents = toCents(row.amount);
        const txData: Prisma.TransactionUncheckedCreateInput = {
          userId,
          budgetId,
          date: new Date(row.date),
          amount: fromCents(amountCents),
          amountCents,
          vendor: row.vendor,
          type: row.type,
          accountId,
          importHash
        };
        if (row.description !== undefined) { txData.description = row.description; }
        // Link expense transactions to their expense item via the sheet Category.
        if (row.type === 'expense' && row.category) {
          const expenseItemId = expenseItemByDescription.get(normalizeKey(row.category));
          if (expenseItemId) { txData.expenseItemId = expenseItemId; }
        }

        const created = await tx.transaction.create({ data: txData });
        await tx.account.update({
          where: { id: accountId },
          data: balanceIncrement(balanceDeltaCents(row.type, amountCents))
        });
        ids.push(created.id);
      }

      return {
        ids,
        skipped,
        adoptedLegacy,
        updatedCount,
        createdItems,
        unmatchedCategories: findUnmatchedCategories(
          transactions,
          Array.from(expenseItemByDescription.keys())
        )
      };
    });

    const result: ConfirmXlsxResult = {
      createdCount: {
        transactions: outcome.ids.length,
        incomeItems: outcome.createdItems.incomeItems,
        expenseItems: outcome.createdItems.expenseItems
      },
      updatedCount: outcome.updatedCount,
      skippedCount: { transactions: outcome.skipped },
      unmatchedCategories: outcome.unmatchedCategories,
      transactionIds: outcome.ids
    };
    logger.info(
      `Excel import for user ${userId}: ${result.createdCount.transactions} tx created, ` +
      `${result.skippedCount.transactions} skipped as already imported ` +
      `(${outcome.adoptedLegacy} of them pre-hash rows that adopted their hash), ` +
      `${result.createdCount.incomeItems}+${result.updatedCount.incomeItems} income items, ` +
      `${result.createdCount.expenseItems}+${result.updatedCount.expenseItems} expense items (created+updated), ` +
      `${result.unmatchedCategories.length} unmatched categories`
    );
    return result;
  }
}

export const xlsxImportService = new XlsxImportService();
