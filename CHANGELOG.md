# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-30

### Breaking
- **Errors**: every error uses one envelope, `{ success: false, message, error, errorCode }`, with a stable `errorCode` per case. Validation errors add `errors: [{ field, message }]`.
- **Budgets**: a budget that belongs to another user returns 404 (was 403).
- **Auth**: registration requires passwords of 8–72 bytes and no longer trims them (logins created under the old rule still work).
- **Config**: the server refuses to boot without `JWT_SECRET` and `DATABASE_URL` (no fallback secrets). JWT is pinned to HS256.
- **API docs**: Swagger UI and the schema endpoints are off in production unless `ENABLE_API_DOCS=true`.
- **Runtime**: Node 22 LTS (Node 20 is end-of-life) in Docker and CI.
- **Budgets**: `Credit Card` is no longer an income type. Existing items moved to `Transfer`.

### Added
- **Money in cents**: amounts and balances are stored as integer cents (`*Cents` columns, backfilled). Overspending an expense line is reported as a status instead of an error.
- **Excel import**: idempotent. Re-confirming the same workbook skips rows already imported and reports unmatched categories.
- **Personal API tokens** (`fpat_…`) for the MCP server and scripts: `read`/`write` scopes, mandatory expiry, max 10 per user, opt-in per route. They don't affect the web session.
- **Screenshot import**: `POST /api/transactions/import/screenshots` (+ `/check`) for movements read from bank screenshots. Repeated or overlapping screenshots insert nothing new: image hash skip and per-fingerprint count reconciliation under a per-user lock. The budget is derived from the movement's date.
- **Transactions**: `occurredAt` (real instant, timestamptz) and `source` (`manual`, `xlsx`, `screenshot`, `statement`) on every write.
- **Cleanup script**: `yarn cleanup:screenshot-import` (dry run by default) for duplicate rows, importer description suffixes and budget re-derivation.
- **CI**: type-check, lint, tests, build, runtime-dependency audit and secret scan on every push and PR.

### Security
- Typed errors and ownership checks across the API. 500s hide internals outside development.
- Rate limiter on login and register. JSON body limit is 100kb (10mb only for imports).
- Patched vulnerable runtime dependencies (express, jsonwebtoken, body-parser, fast-uri, …).
- Logs carry user IDs, not emails.

### Removed
- Dead gamification code and the stale `seed`/`test:db` scripts.

## [1.1.0] - 2026-06-15

### Added
- **Transactions**: transaction summary now returns totals for income, expense, and savings.
- **XLSX import**: enhanced transaction parsing with category linking and updated validation.

### Fixed
- **Transactions**: whitelist editable fields on update to prevent unintended mutations.

[2.0.0]: https://github.com/monzter50/api-gamification-finances/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/monzter50/api-gamification-finances/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/monzter50/api-gamification-finances/releases/tag/v1.0.1
