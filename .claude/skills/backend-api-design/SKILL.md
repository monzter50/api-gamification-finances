---
name: backend-api-design
description: >
  REST API design conventions for this Express + Prisma personal-finance API: URL and
  method naming, HTTP status codes, the JSON response/error envelope, validation error
  shape, pagination, filtering, money in the HTTP contract, idempotency, caching/ETags,
  ownership semantics (404 vs 403), and OpenAPI documentation. Use this skill whenever
  you design, add, rename, or change an endpoint, decide what status code or response
  shape to return, add query params/pagination/filters, design a bulk or import
  endpoint, touch `@openapi` JSDoc, or the user asks "how should this endpoint look",
  "what should this return", "is this RESTful", or anything about the API contract —
  even if they don't say "API design".
---

# Backend API design (this repo)

The API is consumed by an SPA through `@aglaya/api-core` and generated OpenAPI types,
so the **contract is the product**. Every rule below exists to keep that contract
predictable for the frontend and to avoid leaking data between users.

When a rule here conflicts with what an older file does, follow this skill for new
code, and match the existing file's style only for small in-place edits. Don't
"fix" an existing response shape opportunistically — a shape change is a breaking
change for the frontend and needs to be called out to the user.

## 1. Resources and URLs

- Mounted under `/api` (see `src/routes/index.ts`). Plural nouns, kebab-case:
  `/api/accounts`, `/api/budgets/:id/income`.
- IDs are UUIDs (`@default(uuid())`). Validate every `:id` param with `param('id').isUUID()`.
- Nest only for true ownership/composition (`/budgets/:id/expense/:itemId`). Max two
  levels; beyond that, use a top-level resource with a filter (`/transactions?budgetId=`).
- Non-CRUD actions are sub-resources with a verb-ish noun, POST:
  `/transactions/import/xlsx/parse`, `/transactions/import/xlsx/confirm`.
- **Static routes before `/:id`** in the router file (`/summary`, `/monthly/...` sit above
  `/:id` in `routes/transactions.ts`) — Express matches in order and `/:id` swallows them.
- The user is always implied by the JWT. Never accept `userId` from body/query/params
  for user-scoped resources.

## 2. Methods and status codes

| Operation | Method | Success |
|---|---|---|
| List | GET `/foos` | 200 (empty list is still 200, `data: []`) |
| Read one | GET `/foos/:id` | 200 |
| Create | POST `/foos` | 201 with the created resource |
| Full/partial update | PUT `/foos/:id` (existing convention) or PATCH for sub-collections | 200 with the updated resource |
| Delete | DELETE `/foos/:id` | 200 with the deleted resource (existing convention) — or 204 with no body; pick one per resource and document it |
| Async/accepted work | POST | 202 |

Error statuses:

| Status | When | errorCode example |
|---|---|---|
| 400 | Validation failed (`validate` emits `errors[]`, no code), malformed input, bad FK reference | `AMOUNT_OUT_OF_RANGE`, `P2003` |
| 401 | Missing/invalid/expired/blacklisted token | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_BLACKLISTED` |
| 403 | Authenticated but the *account* is not allowed (e.g. deactivated) | `ACCOUNT_DEACTIVATED` |
| 404 | Resource doesn't exist **or isn't owned by the caller** | `FOO_NOT_FOUND` |
| 409 | Unique conflict, state conflict ("account has transactions") | `FOO_ALREADY_EXISTS`, `FOO_HAS_TRANSACTIONS` |
| 413 / 415 | Upload too large / wrong type | `FILE_TOO_LARGE` |
| 422 | Input is valid but semantically unprocessable (workbook with no rows) | `NO_TRANSACTIONS_FOUND` |
| 440 | **Reserved**: session superseded by another login. Don't reuse it. | `SESSION_REVOKED` |
| 500 | Bug. Never a deliberate business outcome. | — |

**Ownership → 404, not 403.** Returning 403 for "exists but belongs to someone else"
tells an attacker the UUID exists. Scope the query by `userId` (`findByIdAndUser`) and
treat "not found for this user" as 404 (`BudgetNotFoundError`, …). An ID the client
sends in the **body** that isn't theirs is a 400 (`INVALID_ACCOUNT_REFERENCE`,
`INVALID_BUDGET_ITEM_REFERENCE`).

**Order of checks matters for the same reason:** verify ownership *before* any
state-based rule. E.g. check "account belongs to user" before "account has
transactions" — otherwise a 409 leaks existence of another user's account.

**Business outcomes are not errors.** Overspending a budget line is recorded and reported
as `status: 'exceeded'` (see `services/ledgerRules.ts`), not rejected. Before adding a
4xx for a domain rule, ask whether it describes what *happened* (record it, report a
status) or what is *impossible* (reject it).

## 3. Response envelope

Success (matches `ApiResponse<T>` in `src/types/index.ts`):

```json
{ "success": true, "message": "Account created successfully", "data": { ... } }
```

Errors — produced ONLY by the global `errorHandler` when a controller calls
`next(error)` with a typed error (subclass of `AppError`, see `src/errors/`):

```json
{ "success": false, "message": "Account not found", "error": "Account not found", "errorCode": "ACCOUNT_NOT_FOUND" }
```

`message` and `error` carry the same text on purpose (older clients read one or the
other). Validation errors — produced by `middleware/validate.ts`:

```json
{ "success": false, "message": "Validation failed", "error": "Validation failed",
  "errorCode": "VALIDATION_ERROR", "errors": [{ "field": "amount", "message": "Amount must be a positive number" }] }
```

Rules:
- `errorCode` is the machine contract (SCREAMING_SNAKE, stable forever); the message is
  for humans and may change. Frontend logic should branch on `errorCode` or status.
- 500s never expose `err.message` outside development. The global handler already hides
  it; controllers that build their own 500 with `(error as Error).message` leak internals
  (Prisma messages, SQL fragments) — route through `next(error)` instead.
- Never build an error response by hand in a controller or middleware — throw/forward
  a typed error. The envelope is documented as `components.schemas.Error` in
  `swagger.config.ts`; keep that schema and `errorHandler` in sync.

## 4. Lists: pagination, filtering, sorting

- Query params: `page` (≥1, default 1), `limit` (1–100, default 10). Validate both with
  `query(...).isInt()`; **always enforce a max `limit`** — an unbounded list is a DoS
  vector and a memory spike.
- Response shape (existing convention in `transaction.controller.ts`):

  ```json
  { "success": true, "data": [...], "pagination": { "page": 1, "limit": 10, "total": 57, "pages": 6 } }
  ```

- Aggregates over the whole filtered set (e.g. `totals`) go next to `pagination`, never
  computed from just the current page.
- Filters are flat, typed, validated query params: `type`, `budgetId`, `startDate`,
  `endDate` (ISO 8601, inclusive range). Every filter must also be scoped by `userId`.
- Sorting, when needed: `sort=date` / `sort=-date` with a **whitelist** of sortable
  fields mapped to Prisma `orderBy`. Never pass a client string straight into `orderBy`.
- Offset pagination is fine at personal-finance scale. Switch to cursor pagination
  (`cursor=<id>&limit=`) only for feeds that grow unbounded or are polled.

## 5. Money in the contract

- The HTTP contract speaks **decimal currency units** (`"amount": 1250.5`); storage is
  **integer cents** (`amountCents`). Convert only at the edges with `toCents` /
  `fromCents` from `src/utils/money.ts`; do all arithmetic in cents.
- Validate amounts with `isFloat({ min: 0.01 })` (or `min: 0` where zero is meaningful).
  Out-of-range values raise `AmountOutOfRangeError` (400) from `toCents`.
- Direction lives in `type` (`income`/`expense`), not in the sign of `amount`. Amounts
  in requests are positive.
- `currency` is a 3-letter ISO 4217 code; default `MXN`.

## 6. Idempotency and bulk operations

- Network retries on POST can double-create money movements. For anything that creates
  transactions in bulk or from an external source, make it idempotent with a natural
  key + unique constraint — the pattern is `importHash` with `@@unique([userId, importHash])`
  in the Excel import: re-importing the same workbook is a no-op for existing rows.
- For single creates that the client may retry, prefer an `Idempotency-Key` header
  stored with a unique constraint over "check then insert".
- Two-phase flows for risky bulk writes: `parse` (no DB writes, returns a preview the
  user reviews) → `confirm` (writes in one `prisma.$transaction`). Follow this for any
  new import source.
- Bulk responses report per-item outcome counts (`created`, `skipped`, `failed`) rather
  than failing the whole batch on one bad row — unless atomicity is the requirement.

## 7. Caching

- Default: no caching headers on user data.
- Hot, read-mostly lists may use the pattern in `AccountController.getUserAccounts`:
  weak ETag derived from the **data** (not the envelope), `Cache-Control: private,
  max-age=60`, manual `If-None-Match` → 304. `private` is mandatory — balances are
  per-user and must never land in a shared cache.
- ETag is disabled globally in development (`server.ts`), so custom ETag logic must not
  rely on Express's automatic 304.

## 8. Versioning and evolution

- Additive changes (new optional field, new endpoint, new enum value the client can
  ignore) are safe. Removing/renaming fields, changing types, or changing status codes
  are breaking.
- `API_VERSION` exists but routes are not version-prefixed. Don't introduce `/v2` for a
  single endpoint; for a real break, discuss with the user (new field + deprecation
  window usually beats a new version).

## 9. Documentation (OpenAPI)

- Document each endpoint with an `@openapi` JSDoc block in `src/routes/*.ts` (scanned
  by `swagger-jsdoc`, see `apis` in `swagger.config.ts`). Include `tags`, `summary`,
  `security: [bearerAuth: []]` for protected routes, request schema, and every response
  status the endpoint can actually return.
- Put reusable schemas in `components.schemas` in `swagger.config.ts`; reference them
  with `$ref`.
- After changing the surface: `yarn export:schema` (and `yarn generate:client` if the
  typed client is used) and commit `openapi-schema.json`.

## Quick design checklist

Before proposing or implementing an endpoint, be able to answer:
1. Path + method, and does a static path need to sit above `/:id`?
2. What does each validator check, including max lengths and `limit` cap?
3. Every status code it can return, each with an `errorCode`?
4. Is every query scoped to `req.user.userId`, with not-owned → 404?
5. Money: decimal in, cents inside, decimal out?
6. Is a retry safe? If not, what's the idempotency key?
7. OpenAPI block written and schema re-exported?
