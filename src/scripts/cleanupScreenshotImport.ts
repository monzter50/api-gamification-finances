/**
 * One-off cleanup for the screenshot-import idempotency plan (phases 3 and 4).
 *
 *   yarn cleanup:screenshot-import --email you@example.com              # dry run (default): prints the plan, writes nothing
 *   yarn cleanup:screenshot-import --email you@example.com --apply \
 *     --expect-duplicates 24 --expect-test-rows 6                       # executes, in ONE transaction
 *
 * What it does, for that user only:
 *  1. Duplicates: same account + date + cents + type + normalised vendor. Keeps
 *     the oldest row (lot A), deletes the rest and reverses their balance.
 *  2. Removes the " — <category>" suffix the old importer appended to the
 *     description of the rows it keeps.
 *  3. Deletes the six confirmed development rows (reversing their balance).
 *  4. Re-derives every remaining row's budget from its date (0-11 months).
 *  5. Only REPORTS rows whose year disagrees with their budget (the 2025
 *     incomes): fixing those dates needs the owner's confirmation.
 *
 * Take a backup first: pg_dump --table='"Transaction"' --table='"Account"' "$DATABASE_URL" > backup.sql
 * --apply refuses to run unless the counts you reviewed in the dry run still match.
 */
import { parseArgs } from 'node:util';
import prisma from '../config/database';
import { fromCents } from '../utils/money';
import { balanceDeltaCents, balanceIncrement } from '../services/ledgerRules';
import { findDuplicateGroups, findTestRows, planBudgetMoves, stripCategorySuffix, type CleanupTx } from './cleanup/plan';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    apply: { type: 'boolean', default: false },
    'expect-duplicates': { type: 'string' },
    'expect-test-rows': { type: 'string' }
  }
});

const day = (d: Date): string => d.toISOString().slice(0, 10);
const money = (cents: number): string => fromCents(cents).toFixed(2);
const line = (t: CleanupTx): string => `${day(t.date)}  ${t.type.padEnd(7)} ${money(t.amountCents).padStart(10)}  ${t.vendor}  [${t.id}]`;

async function main (): Promise<void> {
  if (!values.email) throw new Error('--email is required');
  const user = await prisma.user.findUnique({ where: { email: values.email }, select: { id: true } });
  if (!user) throw new Error(`No user with email ${values.email}`);

  const rows: CleanupTx[] = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      accountId: true,
      date: true,
      occurredAt: true,
      amountCents: true,
      type: true,
      vendor: true,
      description: true,
      budgetId: true,
      expenseItemId: true,
      incomeItemId: true,
      createdAt: true,
      source: true
    },
    orderBy: { date: 'asc' }
  });
  const budgets = await prisma.budget.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      year: true,
      month: true,
      expenseItems: { select: { id: true, description: true } },
      incomeItems: { select: { id: true, description: true } }
    }
  });

  const groups = findDuplicateGroups(rows);
  const duplicates = groups.flatMap((g) => g.remove);
  const duplicateIds = new Set(duplicates.map((t) => t.id));
  const testRows = findTestRows(rows).filter((t) => !duplicateIds.has(t.id));
  const deleteIds = new Set([...duplicateIds, ...testRows.map((t) => t.id)]);
  const kept = rows.filter((t) => !deleteIds.has(t.id));

  const descriptionFixes = groups
    .map((g) => ({ tx: g.keep, to: stripCategorySuffix(g.keep.description) }))
    .filter((f): f is { tx: CleanupTx, to: string } => f.to !== null);
  const { moves, noBudget, suspiciousYear } = planBudgetMoves(kept, budgets);
  const budgetLabel = new Map(budgets.map((b) => [b.id, `${b.year}/month ${b.month}`]));

  const expenseCents = (list: CleanupTx[]): number =>
    list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);

  console.log(`\n${values.apply ? 'APPLY' : 'DRY RUN'} for ${values.email}: ${rows.length} transactions\n`);
  console.log(`1. Duplicate groups: ${groups.length} (${duplicates.length} rows to delete, keeping the oldest)`);
  for (const g of groups) console.log(`   keep ${line(g.keep)}\n     delete ${g.remove.map((r) => r.id).join(', ')}`);
  console.log(`\n2. Description suffixes to strip: ${descriptionFixes.length}`);
  for (const f of descriptionFixes) console.log(`   "${f.tx.description ?? ''}" → "${f.to}"  [${f.tx.id}]`);
  console.log(`\n3. Test rows to delete: ${testRows.length}`);
  for (const t of testRows) console.log(`   ${line(t)}`);
  console.log(`\n4. Budget re-derivations: ${moves.length}`);
  for (const m of moves) {
    const from = m.fromBudgetId !== null ? budgetLabel.get(m.fromBudgetId) ?? m.fromBudgetId : 'none';
    console.log(`   ${line(m.tx)}  ${from} → ${budgetLabel.get(m.toBudgetId)}${m.droppedLink !== null ? `  (clears ${m.droppedLink})` : ''}`);
  }
  console.log(`   No budget exists for their month (left as is): ${noBudget.length}`);
  for (const t of noBudget) console.log(`   ${line(t)}`);
  console.log(`\n5. Year disagrees with budget — confirm the date with the owner, NOT changed: ${suspiciousYear.length}`);
  for (const t of suspiciousYear) console.log(`   ${line(t)}  in ${t.budgetId !== null ? budgetLabel.get(t.budgetId) : 'none'}`);
  console.log(`\nExpenses total: ${money(expenseCents(rows))} now → ${money(expenseCents(kept))} after (plan expects ≈ 25,437.66)\n`);

  if (!values.apply) {
    console.log('Nothing written. Re-run with --apply --expect-duplicates N --expect-test-rows N after a backup.');
    return;
  }
  if (Number(values['expect-duplicates']) !== duplicates.length || Number(values['expect-test-rows']) !== testRows.length) {
    throw new Error(
      `Refusing to apply: found ${duplicates.length} duplicates and ${testRows.length} test rows, ` +
      `expected ${values['expect-duplicates'] ?? '?'} and ${values['expect-test-rows'] ?? '?'}. Re-run the dry run.`
    );
  }

  const toDelete = rows.filter((t) => deleteIds.has(t.id));
  await prisma.$transaction(async (tx) => {
    // Reverse each deleted row's balance effect, one update per account.
    const deltaByAccount = new Map<string, number>();
    for (const t of toDelete) {
      deltaByAccount.set(t.accountId, (deltaByAccount.get(t.accountId) ?? 0) - balanceDeltaCents(t.type, t.amountCents));
    }
    for (const [accountId, delta] of deltaByAccount) {
      if (delta !== 0) await tx.account.update({ where: { id: accountId }, data: balanceIncrement(delta) });
    }
    await tx.transaction.deleteMany({ where: { userId: user.id, id: { in: [...deleteIds] } } });

    for (const f of descriptionFixes) {
      await tx.transaction.update({ where: { id: f.tx.id }, data: { description: f.to } });
    }
    for (const m of moves) {
      await tx.transaction.update({
        where: { id: m.tx.id },
        data: { budgetId: m.toBudgetId, expenseItemId: m.expenseItemId, incomeItemId: m.incomeItemId }
      });
    }
  }, { timeout: 60_000 });
  console.log(`Applied: deleted ${deleteIds.size}, fixed ${descriptionFixes.length} descriptions, moved ${moves.length} rows.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
