# Backend review checklist

Grouped by the severity a violation usually deserves. Adjust with judgment (a missing
index on a table that will hold 50 rows is Low, not Medium).

## Contents
- A. Authorization & data isolation (Critical)
- B. Money & ledger integrity (Critical)
- C. Error handling & information leakage (Critical/High)
- D. Security (Critical/High)
- E. Input validation (High)
- F. Async correctness & transactions (High)
- G. Database & performance (High/Medium)
- H. Migrations (Critical/High)
- I. API contract (High/Medium)
- J. Architecture & layering (Medium)
- K. TypeScript strictness (Medium)
- L. Observability (Medium/Low)
- M. Tests (Medium)
- N. Known repo traps

---

## A. Authorization & data isolation

- [ ] Every new route uses `authenticateJWT` unless deliberately public (and the reason is stated).
- [ ] `userId` comes from `req.user.userId` — never from body, query, or params.
- [ ] Every Prisma query on user data has `userId` in `where` (or is scoped through a
      parent: `budget: { userId }`). Watch for `findUnique({ where: { id } })`,
      `update({ where: { id } })`, `delete({ where: { id } })`, and base-repository
      `findById/updateById/deleteById` used **before** ownership is established.
- [ ] IDs the client references (`accountId`, `budgetId`, `incomeItemId`, …) are verified
      to belong to the same user before being written into a row — FKs don't check ownership.
- [ ] Not-owned is indistinguishable from not-found (404). Ownership checks run **before**
      state checks, so a 409/422 can't reveal another user's row exists.
- [ ] Responses don't include other users' data through `include` (e.g. including `user`
      without `select` returns the password hash).
- [ ] Bulk endpoints validate ownership for **every** item, not just the first.

## B. Money & ledger integrity

- [ ] Arithmetic and comparisons in integer cents; `toCents` at input, `fromCents` at output.
      No `amount * 100`, `parseFloat` sums, or `toFixed` used as math.
- [ ] Both legacy Float and Cents columns written on every money write (expand/contract
      in progress): `balanceIncrement(delta)` for balances; `x = fromCents(xCents)` for rows.
- [ ] Balance changes use atomic `increment`, never read-modify-write.
- [ ] Create/update/delete of a transaction moves the balance in the **same**
      `prisma.$transaction`; update reverses old effect and applies new.
- [ ] Sign logic comes from `balanceDeltaCents(type, cents)`, not a re-implemented `if`.
- [ ] Changing a transaction's `accountId` debits/credits **both** accounts correctly.
- [ ] Imports/bulk creates are idempotent (natural key + unique constraint, like `importHash`).
- [ ] Overspend and similar "what happened" facts are recorded and reported as status, not rejected.

## C. Error handling & information leakage

- [ ] Controllers `catch (error) { next(error) }` (or use the existing handled pattern
      consistently) — no async path can reject without a response.
- [ ] No `res.status(500).json({ error: (error as Error).message })` — leaks Prisma/SQL
      details in production. The global handler already hides 500 messages.
- [ ] Domain failures are typed errors (`AppError` subclasses with `statusCode` +
      `errorCode`), not `new Error('...')` string-matched in the controller.
- [ ] Auth failures don't reveal which part failed (`InvalidCredentialsError` for both
      unknown email and wrong password).
- [ ] Errors aren't swallowed (`catch {}` / `catch { return null }`) without a reason in a comment.

## D. Security

- [ ] No secrets, tokens, passwords or full JWTs in logs, responses, or committed files.
- [ ] No new fail-open defaults like `process.env.X ?? 'default_secret'` for secrets.
- [ ] Never spread `req.body` into Prisma `data` — whitelist fields (mass assignment:
      a client could set `userId`, `balanceCents`, `role`).
- [ ] No raw SQL with string interpolation; `$queryRaw` uses tagged templates only.
- [ ] Uploads: size limit, MIME + extension check, in-memory processing, no path built
      from user filenames.
- [ ] User-controlled values never reach `orderBy`, `include`, or `select` without a whitelist.
- [ ] No `app.set('trust proxy', true)`; CORS not widened to `*` with credentials.
- [ ] Password hashes never selected for responses (`findByIdWithoutPassword` / explicit `select`).

## E. Input validation

- [ ] Every route that takes input has validators **and** the `validate` middleware after them.
- [ ] `:id` params validated with `isUUID()` (a missing check turns garbage into a 500 or Prisma error).
- [ ] Strings: `trim()`, `notEmpty()` where required, `isLength({ max })`.
- [ ] Enum-like fields: `isIn([...])` from a shared constant that also feeds the TS type.
- [ ] Numbers: type + range (`isFloat({ min: 0.01 })` for amounts, `isInt` for counts).
- [ ] Dates: `isISO8601()`; ranges where `start <= end` matters are checked.
- [ ] Lists: `limit` has a max (≤100).
- [ ] Controllers don't re-run `validationResult` after `validate` (dead duplicate code with a different error shape).

## F. Async correctness & transactions

- [ ] Every promise is awaited or deliberately fire-and-forget with `.catch` logging.
- [ ] Multi-row invariants inside one `prisma.$transaction(async (tx) => ...)`, using
      `tx` (not the global `prisma`) for every write inside it.
- [ ] No HTTP calls, AI/model calls, file parsing, or long loops inside a DB transaction.
- [ ] Check-then-act races on money or uniqueness are backed by a constraint or moved
      inside the transaction.

## G. Database & performance

- [ ] No queries inside loops / `map` (N+1), including `Promise.all(items.map(q))`.
      Use `groupBy`, `aggregate`, or `where: { id: { in } }`.
- [ ] Aggregations done in the DB, not by loading rows into JS.
- [ ] New `where`/`orderBy` patterns have a supporting index (leftmost prefix starts with `userId`).
- [ ] Every `findMany` on growing user data is bounded with `take`.
- [ ] Repositories use the shared `prisma` from `config/database` — no `new PrismaClient()`.
- [ ] `super('<model>')` name matches the Prisma model (lowercase first letter).

## H. Migrations

- [ ] Schema change has a migration; `schema.prisma` and SQL are consistent.
- [ ] No edit to an already-applied migration.
- [ ] Safe during rolling deploy (old app still running): no drop/rename the old code
      still reads; new `NOT NULL` columns have a default or backfill.
- [ ] New unique constraints: existing data checked for duplicates first.
- [ ] Backfills are deterministic SQL in the migration, with a header comment.
- [ ] Nothing runs migrations at container start.

## I. API contract

- [ ] Status codes per `backend-api-design` (201 on create, 404 for not-owned, 440 reserved).
- [ ] Success envelope `{ success, message, data }`; errors carry a stable `errorCode`.
- [ ] Breaking changes (removed/renamed fields, changed types/status codes) are called
      out explicitly for the frontend.
- [ ] Storage-only fields (`userId`, `*Cents`, `importHash`, password) aren't exposed
      unless intended.
- [ ] Static routes registered before `/:id`.
- [ ] `@openapi` block added/updated; `yarn export:schema` run; `openapi-schema.json` committed.

## J. Architecture & layering

- [ ] Controllers: no Prisma, no business rules. Services: no `req`/`res`, no status codes.
      Repositories: Prisma only, return rows/null, no HTTP errors.
- [ ] Singletons exported (`fooService`, `fooRepository`, `fooController`) and controller
      methods `.bind(controller)` in routes.
- [ ] Shared `include` constants instead of ad-hoc `include:` blocks.
- [ ] Business rules shared across entry points (API, import) live in one function.
- [ ] No dead gamification references (badges, achievements, levels, coins, experience).

## K. TypeScript strictness

- [ ] `req.params` destructured with a cast: `req.params as { id: string }`.
- [ ] Optional fields assigned conditionally under `exactOptionalPropertyTypes`.
- [ ] New `any` justified; prefer `Prisma.FooWhereInput`/`UpdateInput` types.
- [ ] Non-null assertions (`!`) only where a middleware guarantees it (`req.user!` after `authenticateJWT`).
- [ ] Relative imports (aliases are mostly unused and plain `tsc` builds don't rewrite them).

## L. Observability

- [ ] Uses `logger` from `config/logger`, not `console.*`.
- [ ] Money movements log entity IDs and deltas (existing pattern), never tokens or PII
      beyond IDs.
- [ ] Unexpected errors logged once with context (the global handler already logs —
      avoid double-logging the same error in the controller).

## M. Tests

- [ ] New business rules have unit tests; money rules assert exact cents written.
- [ ] Ownership negative case tested (other user's ID → not found).
- [ ] Mocks follow the existing pattern (`vi.mock` for repositories and `config/database`
      with a fake `$transaction`).
- [ ] No test points at a non-test database.

## N. Known repo traps (check when the diff touches these areas)

- Regressions of fixed issues: a new `throw new Error(...)` for an expected outcome, a
  controller building its own error JSON, `budgetRepository.findById` (unscoped) used for
  an ownership decision, a secret read via `process.env.X ?? 'default'`, a new route
  without `validate` / `isUUID()`.
- `PATCH /budgets/:id/income|expense` replaces all items via `deleteMany`; linked
  transactions silently lose their `incomeItemId`/`expenseItemId` (FK `SetNull`). Flag
  any change that widens this.
- Budget repository methods throw `BudgetNotFoundError` in a few places
  (`getPaginated*Items`) — acceptable, but prefer returning `null` from new repo methods.
- Old bcrypt hashes are cost 10; there's no rehash-on-login yet.
- `package.json` `resolutions` force patched transitive versions (`fast-uri`, `source-map-js`,
  `uuid` for exceljs, `vite` dedupe). Don't drop one without re-running `yarn audit`;
  revisit them when the parent packages ship fixes.
