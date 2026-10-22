/**
 * Finds and removes transactions that were imported more than once.
 *
 *   yarn dedupe:transactions --user <email|userId>             # dry run (default)
 *   yarn dedupe:transactions --user <email|userId> --apply     # delete + fix balances
 *   yarn dedupe:transactions --all-users [--apply]
 *   ... --batch-gap-seconds 60                                 # see planDuplicateCleanup
 *
 * Deleting a transaction must undo its effect on the account balance, exactly
 * like `TransactionService.deleteTransaction` does; both happen in one DB
 * transaction so a failure leaves the ledger untouched.
 */
import prisma from '../config/database';
import { balanceDeltaCents, balanceIncrement } from '../services/ledgerRules';
import { DEFAULT_BATCH_GAP_MS, planDuplicateCleanup, type DuplicateGroup } from '../services/xlsxImport/dedupe';

interface Options {
  user: string | null
  allUsers: boolean
  apply: boolean
  batchGapMs: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseArgs = (argv: string[]): Options => {
  const options: Options = { user: null, allUsers: false, apply: false, batchGapMs: DEFAULT_BATCH_GAP_MS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--all-users') options.allUsers = true;
    else if (arg === '--user') options.user = argv[++i] ?? null;
    else if (arg === '--batch-gap-seconds') options.batchGapMs = Number(argv[++i]) * 1000;
    else throw new Error(`Unknown argument: ${arg ?? ''}`);
  }
  if (options.user === null && !options.allUsers) {
    throw new Error('Pass --user <email|userId> or --all-users');
  }
  if (!Number.isFinite(options.batchGapMs) || options.batchGapMs < 0) {
    throw new Error('--batch-gap-seconds must be a non-negative number');
  }
  return options;
};

const resolveUserIds = async (options: Options): Promise<string[]> => {
  if (options.allUsers) {
    return (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
  }
  const user = options.user ?? '';
  const found = await prisma.user.findFirst({
    where: UUID.test(user) ? { id: user } : { email: user.toLowerCase() },
    select: { id: true }
  });
  if (!found) throw new Error(`User not found: ${user}`);
  return [found.id];
};

const pesos = (cents: number): string =>
  (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const report = (plan: DuplicateGroup[], accountNames: Map<string, string>): void => {
  for (const group of plan) {
    const [first] = group.keep;
    if (!first) continue;
    console.log(
      `\n${first.date.toISOString().slice(0, 10)}  ${first.vendor}  ${first.type}  ` +
      `${pesos(first.amountCents)}  [${accountNames.get(first.accountId) ?? first.accountId}]`
    );
    for (const row of group.keep) console.log(`  keep    ${row.id}  created ${row.createdAt.toISOString()}${row.importHash ? '  (hashed)' : ''}`);
    for (const row of group.remove) console.log(`  remove  ${row.id}  created ${row.createdAt.toISOString()}`);
  }

  const toRemove = plan.flatMap((g) => g.remove);
  const balanceFix = new Map<string, number>();
  for (const row of toRemove) {
    balanceFix.set(row.accountId, (balanceFix.get(row.accountId) ?? 0) - balanceDeltaCents(row.type, row.amountCents));
  }
  console.log(`\n${plan.length} duplicate groups, ${toRemove.length} rows to remove.`);
  for (const [accountId, cents] of balanceFix) {
    console.log(`  balance ${accountNames.get(accountId) ?? accountId}: ${cents >= 0 ? '+' : ''}${pesos(cents)}`);
  }
};

const apply = async (plan: DuplicateGroup[]): Promise<number> => {
  const toRemove = plan.flatMap((g) => g.remove);
  if (toRemove.length === 0) return 0;

  const balanceFix = new Map<string, number>();
  for (const row of toRemove) {
    balanceFix.set(row.accountId, (balanceFix.get(row.accountId) ?? 0) - balanceDeltaCents(row.type, row.amountCents));
  }

  return await prisma.$transaction(async (tx) => {
    // Guard against the ledger moving between planning and applying: delete
    // only rows still exactly as planned, and roll back if any changed.
    const deleted = await tx.transaction.deleteMany({
      where: {
        OR: toRemove.map((row) => ({ id: row.id, amountCents: row.amountCents, type: row.type, accountId: row.accountId }))
      }
    });
    if (deleted.count !== toRemove.length) {
      throw new Error(`Expected to delete ${toRemove.length} rows but matched ${deleted.count}; ledger changed, nothing applied.`);
    }
    for (const [accountId, cents] of balanceFix) {
      await tx.account.update({ where: { id: accountId }, data: balanceIncrement(cents) });
    }
    return deleted.count;
  });
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const userIds = await resolveUserIds(options);

  const rows = await prisma.transaction.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      accountId: true,
      date: true,
      amountCents: true,
      vendor: true,
      type: true,
      importHash: true,
      createdAt: true,
      account: { select: { name: true } }
    }
  });
  const accountNames = new Map<string, string>(rows.map((r) => [r.accountId, r.account.name]));

  const plan = planDuplicateCleanup(rows, options.batchGapMs);
  report(plan, accountNames);

  if (!options.apply) {
    console.log('\nDry run — nothing changed. Re-run with --apply to delete.');
    return;
  }
  const count = await apply(plan);
  console.log(`\nApplied: ${count} rows deleted, balances adjusted.`);
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
