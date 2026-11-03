import { type Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { accountRepository } from '../../repositories/account.repository';
import { InvalidAccountReferenceError } from '../../errors/DomainErrors';
import { InvalidScreenshotRowError } from '../../errors/ScreenshotImportErrors';
import { toCents, fromCents } from '../../utils/money';
import { localParts } from '../../utils/localTime';
import { balanceDeltaCents, balanceIncrement } from '../ledgerRules';
import { budgetPeriodOf } from '../budgetPeriod';
import { fingerprintOf, inferOccurredAt, normDescriptor } from './fingerprint';
import { planInsertions } from './reconcile';
import {
  type ScreenshotImportPayload,
  type ScreenshotImportResult,
  type ScreenshotRow
} from './types';

interface PreparedRow {
  fingerprint: string
  occurredAt: Date
  amountCents: number
  rawDescriptor: string
  descriptorNorm: string
  type: ScreenshotRow['type']
  description?: string
}

/** Interactive-transaction timeout: a full batch is a few hundred small writes. */
const TX_TIMEOUT_MS = 30_000;

const periodKey = (p: { year: number, month: number }): string => `${p.year}-${p.month}`;

/**
 * Screenshot Import Service
 *
 * Idempotent import of bank movements read from screenshots:
 *  1. An image whose SHA-256 was imported before is skipped whole.
 *  2. Each row gets its real local time and inferred year (`occurredAt`) and a
 *     fingerprint (account + minute + cents + type + normalised descriptor).
 *  3. Count reconciliation (`planInsertions`) inserts only what the ledger is
 *     missing, so re-imports and overlapping screenshots add nothing while two
 *     identical purchases in one screenshot stay two.
 *  4. The budget comes from `occurredAt` (`budgetPeriodOf`), never the caller.
 *
 * Everything runs in one transaction holding a per-user advisory lock, so two
 * concurrent imports of the same batch serialise and the second inserts 0.
 */
export class ScreenshotImportService {
  /** Which of these image hashes were already imported — lets the client skip OCR. */
  async findImportedImages (userId: string, sha256s: string[]): Promise<string[]> {
    const rows = await prisma.importImage.findMany({
      where: { userId, sha256: { in: sha256s.map((s) => s.toLowerCase()) } },
      select: { sha256: true }
    });
    return rows.map((r) => r.sha256);
  }

  private prepareRow (userId: string, accountId: string, row: ScreenshotRow, uploadedAt: Date): PreparedRow {
    const occurredAt = inferOccurredAt(row, uploadedAt);
    const local = localParts(occurredAt);
    if (local.day !== row.day || local.month !== row.month) {
      throw new InvalidScreenshotRowError(`${row.day}/${row.month} is not a valid date`);
    }
    const rawDescriptor = row.rawDescriptor.trim();
    const descriptorNorm = normDescriptor(rawDescriptor);
    if (descriptorNorm === '') {
      throw new InvalidScreenshotRowError(`Descriptor "${rawDescriptor}" has no letters or digits`);
    }
    const amountCents = toCents(row.amount);
    const prepared: PreparedRow = {
      occurredAt,
      amountCents,
      rawDescriptor,
      descriptorNorm,
      type: row.type,
      fingerprint: fingerprintOf({ userId, accountId, occurredAt, amountCents, type: row.type, descriptorNorm })
    };
    const description = row.description?.trim();
    if (description) prepared.description = description;
    return prepared;
  }

  async importBatch (
    userId: string,
    payload: ScreenshotImportPayload,
    uploadedAt: Date = new Date()
  ): Promise<ScreenshotImportResult> {
    const { accountId } = payload;
    const account = await accountRepository.findByIdAndUser(accountId, userId);
    if (!account) throw new InvalidAccountReferenceError(accountId);

    // Prepare outside the transaction: pure CPU, and fails fast on bad rows.
    // The same file twice in one request counts as one image.
    const seen = new Set<string>();
    let duplicateInRequest = 0;
    const images: Array<{ sha256: string, rows: PreparedRow[] }> = [];
    for (const image of payload.images) {
      const sha256 = image.sha256.toLowerCase();
      if (seen.has(sha256)) { duplicateInRequest++; continue; }
      seen.add(sha256);
      images.push({ sha256, rows: image.rows.map((r) => this.prepareRow(userId, accountId, r, uploadedAt)) });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      // Serialise imports per user: `m` below must not change until we commit.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}))`;

      const known = new Set((await tx.importImage.findMany({
        where: { userId, sha256: { in: images.map((i) => i.sha256) } },
        select: { sha256: true }
      })).map((i) => i.sha256));
      const fresh = images.filter((i) => !known.has(i.sha256));

      const fingerprints = [...new Set(fresh.flatMap((i) => i.rows.map((r) => r.fingerprint)))];
      const counts = fingerprints.length === 0
        ? []
        : await tx.transaction.groupBy({
          by: ['fingerprint'],
          where: { userId, fingerprint: { in: fingerprints } },
          _count: { _all: true }
        });
      const existing = new Map(counts.map((c) => [c.fingerprint ?? '', c._count._all]));

      const { toInsert, skippedAsDuplicate } = planInsertions(fresh, existing);

      // Budget per row from its own date (one query for every period involved).
      const periods = new Map(toInsert.map((r) => {
        const p = budgetPeriodOf(r.occurredAt);
        return [periodKey(p), p];
      }));
      const budgets = periods.size === 0
        ? []
        : await tx.budget.findMany({
          where: { userId, OR: [...periods.values()] },
          select: { id: true, year: true, month: true }
        });
      const budgetByPeriod = new Map(budgets.map((b) => [periodKey(b), b.id]));

      const skippedImages = images.length - fresh.length + duplicateInRequest;
      const batch = await tx.importBatch.create({
        data: {
          userId,
          accountId,
          source: 'screenshot',
          inserted: toInsert.length,
          skippedAsDuplicate,
          skippedImages
        }
      });
      if (fresh.length > 0) {
        await tx.importImage.createMany({
          data: fresh.map((i) => ({ userId, sha256: i.sha256, batchId: batch.id }))
        });
      }

      let unbudgeted = 0;
      let deltaCents = 0;
      const data = toInsert.map((r): Prisma.TransactionCreateManyInput => {
        const budgetId = budgetByPeriod.get(periodKey(budgetPeriodOf(r.occurredAt))) ?? null;
        if (budgetId === null) unbudgeted++;
        deltaCents += balanceDeltaCents(r.type, r.amountCents);
        return {
          userId,
          accountId,
          budgetId,
          date: r.occurredAt,
          occurredAt: r.occurredAt,
          amount: fromCents(r.amountCents),
          amountCents: r.amountCents,
          vendor: r.rawDescriptor,
          rawDescriptor: r.rawDescriptor,
          descriptorNorm: r.descriptorNorm,
          fingerprint: r.fingerprint,
          type: r.type,
          description: r.description ?? null,
          source: 'screenshot',
          importBatchId: batch.id
        };
      });

      const created = data.length === 0
        ? []
        : await tx.transaction.createManyAndReturn({ data, select: { id: true } });
      if (deltaCents !== 0) {
        await tx.account.update({ where: { id: accountId }, data: balanceIncrement(deltaCents) });
      }

      return {
        batchId: batch.id,
        inserted: created.length,
        skippedAsDuplicate,
        skippedImages,
        unbudgeted,
        transactionIds: created.map((c) => c.id)
      };
    }, { timeout: TX_TIMEOUT_MS });

    logger.info(
      `Screenshot import ${outcome.batchId} for user ${userId}: ${outcome.inserted} inserted, ` +
      `${outcome.skippedAsDuplicate} skipped as duplicate, ${outcome.skippedImages} images skipped, ` +
      `${outcome.unbudgeted} without a budget`
    );
    return outcome;
  }
}

export const screenshotImportService = new ScreenshotImportService();
