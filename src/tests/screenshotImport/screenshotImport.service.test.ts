import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screenshotImportService } from '../../services/screenshotImport/screenshotImport.service';
import { accountRepository } from '../../repositories/account.repository';
import { fingerprintOf, normDescriptor } from '../../services/screenshotImport/fingerprint';

const tx = {
  $queryRaw: vi.fn(),
  importImage: { findMany: vi.fn(), createMany: vi.fn() },
  importBatch: { create: vi.fn() },
  transaction: { groupBy: vi.fn(), createManyAndReturn: vi.fn() },
  budget: { findMany: vi.fn() },
  account: { update: vi.fn() }
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => await fn(tx),
    importImage: { findMany: vi.fn() }
  }
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../repositories/account.repository', () => ({
  accountRepository: { findByIdAndUser: vi.fn() }
}));

const USER = 'user-1';
const ACC = 'acc-1';
const UPLOADED = new Date('2026-10-28T18:00:00Z');
const IMG1 = 'a'.repeat(64);
const IMG2 = 'b'.repeat(64);

const oxxo = { day: 23, month: 10, time: '10:10', rawDescriptor: 'OXXO Centro', amount: 59, type: 'expense' as const };
const unicef = { day: 23, month: 10, time: '11:05', rawDescriptor: 'Stripe *unicef mx', amount: 100, type: 'expense' as const };
const salary = { day: 15, month: 10, time: '06:00', rawDescriptor: 'Nomina', amount: 20000, type: 'income' as const };

const fpOf = (r: typeof oxxo | typeof unicef | typeof salary, occurredAt: string) => fingerprintOf({
  userId: USER, accountId: ACC, occurredAt: new Date(occurredAt), amountCents: Math.round(r.amount * 100), type: r.type, descriptorNorm: normDescriptor(r.rawDescriptor)
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accountRepository.findByIdAndUser).mockResolvedValue({ id: ACC } as never);
  tx.importImage.findMany.mockResolvedValue([]);
  tx.transaction.groupBy.mockResolvedValue([]);
  tx.budget.findMany.mockResolvedValue([{ id: 'budget-oct', year: 2026, month: 9 }]);
  tx.importBatch.create.mockResolvedValue({ id: 'batch-1' });
  tx.transaction.createManyAndReturn.mockImplementation(async ({ data }: { data: unknown[] }) =>
    data.map((_, i) => ({ id: `tx-${i + 1}` })));
});

describe('ScreenshotImportService.importBatch', () => {
  it('takes the per-user advisory lock before reading counts', async () => {
    await screenshotImportService.importBatch(USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo] }] }, UPLOADED);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.transaction.groupBy.mock.invocationCallOrder[0]!);
  });

  it('inserts rows with local time, fingerprint, derived budget and no category in description', async () => {
    const result = await screenshotImportService.importBatch(
      USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo, { ...unicef, description: 'donación' }] }] }, UPLOADED
    );

    expect(result).toEqual({
      batchId: 'batch-1', inserted: 2, skippedAsDuplicate: 0, skippedImages: 0, unbudgeted: 0, transactionIds: ['tx-1', 'tx-2']
    });
    const { data } = tx.transaction.createManyAndReturn.mock.calls[0]![0];
    expect(data[0]).toMatchObject({
      userId: USER,
      accountId: ACC,
      budgetId: 'budget-oct',
      occurredAt: new Date('2026-10-23T15:10:00Z'),
      date: new Date('2026-10-23T15:10:00Z'),
      amountCents: 5900,
      vendor: 'OXXO Centro',
      rawDescriptor: 'OXXO Centro',
      descriptorNorm: 'oxxocentro',
      fingerprint: fpOf(oxxo, '2026-10-23T15:10:00Z'),
      description: null,
      source: 'screenshot',
      importBatchId: 'batch-1'
    });
    expect(data[1].description).toBe('donación');
    expect(tx.budget.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER, OR: [{ year: 2026, month: 9 }] }
    }));
  });

  it('moves the account balance once by the net of the inserted rows', async () => {
    await screenshotImportService.importBatch(USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo, salary] }] }, UPLOADED);
    expect(tx.account.update).toHaveBeenCalledTimes(1);
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: ACC },
      data: { balance: { increment: 19941 }, balanceCents: { increment: 1994100 } }
    });
  });

  it('case 1: re-import of rows already in the ledger inserts 0 and leaves the balance alone', async () => {
    tx.transaction.groupBy.mockResolvedValue([{ fingerprint: fpOf(oxxo, '2026-10-23T15:10:00Z'), _count: { _all: 1 } }]);
    const result = await screenshotImportService.importBatch(USER, { accountId: ACC, images: [{ sha256: IMG2, rows: [oxxo] }] }, UPLOADED);
    expect(result.inserted).toBe(0);
    expect(result.skippedAsDuplicate).toBe(1);
    expect(tx.transaction.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('case 2: an image imported before is skipped whole, without counting its rows', async () => {
    tx.importImage.findMany.mockResolvedValue([{ sha256: IMG1 }]);
    const result = await screenshotImportService.importBatch(USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo, unicef] }] }, UPLOADED);
    expect(result).toMatchObject({ inserted: 0, skippedImages: 1, skippedAsDuplicate: 0 });
    expect(tx.importImage.createMany).not.toHaveBeenCalled();
  });

  it('the same file twice in one request counts once', async () => {
    const result = await screenshotImportService.importBatch(
      USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo] }, { sha256: IMG1.toUpperCase(), rows: [oxxo] }] }, UPLOADED
    );
    expect(result).toMatchObject({ inserted: 1, skippedImages: 1 });
    expect(tx.importImage.createMany).toHaveBeenCalledWith({ data: [{ userId: USER, sha256: IMG1, batchId: 'batch-1' }] });
  });

  it('case 3 + 4 end to end: overlap is dropped, legit twins kept', async () => {
    const result = await screenshotImportService.importBatch(USER, {
      accountId: ACC,
      images: [{ sha256: IMG1, rows: [oxxo, oxxo, unicef] }, { sha256: IMG2, rows: [oxxo, salary] }]
    }, UPLOADED);
    expect(result).toMatchObject({ inserted: 4, skippedAsDuplicate: 1 });
  });

  it('leaves budgetId null and reports it when the month has no budget', async () => {
    tx.budget.findMany.mockResolvedValue([]);
    const result = await screenshotImportService.importBatch(USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [oxxo] }] }, UPLOADED);
    expect(result.unbudgeted).toBe(1);
    expect(tx.transaction.createManyAndReturn.mock.calls[0]![0].data[0].budgetId).toBeNull();
  });

  it('rejects an account the caller does not own (400, before any write)', async () => {
    vi.mocked(accountRepository.findByIdAndUser).mockResolvedValue(null);
    await expect(screenshotImportService.importBatch(USER, { accountId: 'foreign', images: [{ sha256: IMG1, rows: [oxxo] }] }, UPLOADED))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_ACCOUNT_REFERENCE' });
    expect(tx.importBatch.create).not.toHaveBeenCalled();
  });

  it('rejects an impossible date like 31 de febrero', async () => {
    await expect(screenshotImportService.importBatch(
      USER, { accountId: ACC, images: [{ sha256: IMG1, rows: [{ ...oxxo, day: 31, month: 2 }] }] }, UPLOADED
    )).rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_SCREENSHOT_ROW' });
  });
});
