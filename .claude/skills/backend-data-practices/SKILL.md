---
name: backend-data-practices
description: >
  Data and database practices for this Prisma 5 + PostgreSQL finance API: schema/model
  design, indexes, safe migrations (expand/contract), money as integer cents, atomic
  multi-write invariants with prisma.$transaction, per-user data scoping, N+1 and query
  performance, enums-as-strings, cascades and deletes, repository patterns and the
  BaseRepository gotchas. Use this skill whenever you edit prisma/schema.prisma, create
  or review a migration, write or change a repository/Prisma query, touch anything that
  moves money or balances, add an aggregate/report query, or the user asks about
  indexes, performance, data integrity, transactions, or "how should I store X" — even
  if they don't mention Prisma by name.
---

# Backend data & DB practices (this repo)

This is a ledger: account balances must always equal the sum of what happened. Most
rules here protect one of three invariants — **money is exact**, **balances never drift
from transactions**, and **a user only ever sees their own rows**.

## 1. Money

- Store money as **integer cents** (`Int`): `amountCents`, `balanceCents`. Floats can't
  represent 0.1 exactly; sums drift and `SUM()` in Postgres disagrees with JS.
- Convert only at the edges: `toCents(decimal)` on the way in, `fromCents(cents)` on the
  way out (`src/utils/money.ts`). Compare, add, and subtract in cents.
- `toCents` caps at Postgres `INTEGER` max (≈21.4M units). If a feature can exceed that
  (e.g. yearly aggregates stored as a column), use `BigInt` for that column — don't
  silently widen everything.
- **Expand/contract in progress:** `amount`/`balance` (`Float`) still exist and are still
  written. Every write path must update **both** columns, derived from the cents value:
  - balance moves: `balanceIncrement(deltaCents)` from `services/ledgerRules.ts`
  - row writes: `amountCents = toCents(x); amount = fromCents(amountCents)`
  - reads: serve the decimal derived from cents (`withExactBalance` in `account.repository.ts`)
  New money columns are cents-only from day one; don't add new `Float` money columns.

## 2. Balance invariants and transactions

- **Transactions are the only primitive that moves `Account.balance`.** Budget
  income/expense items are plans, not money movement.
- Any operation that writes more than one row to preserve an invariant goes in **one**
  `prisma.$transaction(async (tx) => { ... })`, using `tx.*` (not the global `prisma`)
  for every write inside. A write through the global client inside the callback escapes
  the transaction and won't roll back.
- Balance changes use atomic `{ increment: n }`, never read-modify-write
  (`balance = account.balance + x`) — concurrent requests would lose updates.
- Update = **reverse the old effect fully, then apply the new effect fully** (see
  `TransactionService.updateTransaction`). It handles amount, type and account changes
  uniformly, including moving between accounts.
- The sign rule lives in one place: `balanceDeltaCents(type, cents)`. Every path that
  writes transactions (API, Excel import, future receipt import) must use it.
- Keep transactions short: do validation reads and computation *before* opening the
  `$transaction`; inside, only the writes (and reads that must be consistent with them).
  Never call external services (HTTP, AI models, file parsing) inside a DB transaction.
- Read-validate-write races (e.g. "remaining income ≥ amount") are acceptable at
  single-user scale; if a check guards money that concurrent requests can exhaust, move
  the check inside the transaction or enforce it with a constraint.

## 3. Ownership scoping

- Every query on user data includes `userId` in `where`:
  `findFirst({ where: { id, userId } })`, not `findUnique({ where: { id } })` followed by
  an `if (row.userId !== userId)` check — the second form is easy to forget and leaks
  existence through different error paths.
- Child resources without a `userId` column (`IncomeItem`, `ExpenseItem`) are scoped
  through their parent: `where: { id, budget: { userId } }`.
- When a write references another row by ID from the client (`accountId`, `budgetId`,
  `incomeItemId`), verify that row belongs to the same user before writing — FKs only
  prove existence, not ownership (`assertAccountBelongsToUser` is the pattern).
- Base repository methods (`findById`, `updateById`, `deleteById`) are **unscoped**. Only
  use them after ownership has been established, or prefer scoped longhand methods.

## 4. Schema design conventions

```prisma
model Foo {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  // ...fields...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])            // at minimum; usually a composite matching the main list query
}
```

- Every user-owned model has `userId` + relation + an index starting with `userId`.
- Add the matching back-relation on `User` (`foos Foo[]`).
- Enum-like values are `String` with a comment listing allowed values, enforced by
  `isIn([...])` in validators and a TS union type (existing convention, e.g.
  `Account.type`). A shared constant array should feed both the validator and the type
  so they can't drift. Prisma `enum` is fine for a new, truly closed set — but adding a
  value later requires a migration, which is why the repo has avoided it.
- Nullable only when "unknown/not applicable" is a real state. Prefer defaults.
- Natural uniqueness belongs in the DB: `@@unique([userId, year, month])` on `Budget`,
  `@@unique([userId, importHash])` on `Transaction`. App-level "check then insert" is a
  race; the constraint is the guarantee and P2002 → 409 is handled globally.

### Deletes and cascades

- `onDelete: Cascade` only for true composition (budget → its items). Never cascade
  into money movement: deleting an account must not silently delete transactions — the
  service refuses (409) instead.
- Deleting a transaction must reverse its balance effect in the same `$transaction`.
- Prefer a status flag (`isActive`) over hard delete for anything referenced by
  financial history.

## 5. Indexes and query performance

- Design indexes from the queries, leftmost-prefix: list queries filter by `userId`
  then range over `date`, so `@@index([userId, date])` and `@@index([userId, type, date])`.
  An index on `[date, userId]` would not serve them.
- Every FK column used in `where` or joins gets an index (`budgetId`, `accountId`, ...).
  Postgres does **not** index FKs automatically.
- Don't add redundant indexes: a `@@unique` already creates an index, and `@@index([a])`
  is redundant next to `@@index([a, b])` (e.g. `Budget` has both).
- **No N+1:** a query inside `map`/loop over rows is N+1, even wrapped in `Promise.all`
  (it just fires N queries at once and exhausts the pool). Use `groupBy` /
  `aggregate` / one `findMany({ where: { id: { in: ids } } })` and join in memory.
  Known instance to avoid copying: `getBudgetBalance` issues one sum query per budget
  item — the fix is a single `transaction.groupBy({ by: ['expenseItemId'], _sum: { amountCents: true }, where: { expenseItemId: { in: ids } } })`.
- Aggregate in the DB (`_sum`, `_count`, `groupBy`), not by loading rows into JS.
- Select what you need (`select`) for large lists; use shared `include` constants
  (`transactionIncludes`) for consistent relational shape.
- Every list query is bounded (`take`). No unbounded `findMany` on user data that grows.

## 6. Migrations

- Create: `yarn prisma migrate dev --name <snake_case_description>`; then
  `yarn prisma generate`. Commit `schema.prisma` and the migration folder together.
- **Never edit a migration that has been applied anywhere** (staging/prod). Fix forward
  with a new migration.
- Production applies migrations via Railway `preDeployCommand` (`prisma migrate deploy`)
  — never on container start.
- Migrations must be safe while the **previous app version is still running** (rolling
  deploy). That means **expand/contract** for any breaking change:
  1. *Expand*: add the new column nullable or with a default; backfill in SQL; app writes
     both old and new.
  2. Deploy app that reads new, writes both.
  3. *Contract* (separate, later migration): drop the old column once verified.
  `20261013120000_finance_rules_phase_1` is the reference example (Float → cents).
- Dangerous operations to flag to the user before doing: dropping/renaming a column or
  table, adding `NOT NULL` without a default/backfill, changing a column type, adding a
  unique constraint to a table that may already contain duplicates (check first), and
  long table rewrites on big tables.
- Data fixes belong in migration SQL (deterministic, reviewed, applied once), not in
  ad-hoc scripts run against prod.
- Hand-edit the generated SQL when Prisma can't express the intent (backfills,
  `ROUND(x * 100)::numeric`), and keep a header comment explaining why.

## 7. Repository patterns

- One Prisma client: `import prisma from '../config/database'`. Never `new PrismaClient()`.
- Repositories extend `BaseRepository<T>` with `super('<lowercaseModelName>')` — a typo
  here is a runtime crash, not a type error.
- `this.model` is `any`. For queries where types matter, write them against
  `prisma.<model>` directly (fully typed) instead of `this.model`.
- Repositories return Prisma rows (or `null` for "not found for this user"); services
  turn `null` into typed errors. Repositories don't throw HTTP-flavoured errors.
- Methods that need to join a caller's transaction accept an optional
  `client: Prisma.TransactionClient = prisma` parameter.
- Build `where` objects with `Prisma.FooWhereInput` instead of `any` so a misspelled
  field fails type-check.

## 8. Testing data logic

- Pure rules (cents math, status, deltas) live in plain functions (`ledgerRules.ts`,
  `money.ts`) and get direct unit tests — keep extracting rules this way.
- Service tests mock repositories and `config/database` with a `$transaction` that
  invokes the callback with a fake `tx` (see `tests/financeRules/transactionService.test.ts`),
  then assert the exact `increment` values sent to `tx.account.update`.
- Integration tests against Postgres must use a dedicated test DB; never dev/staging/prod.
