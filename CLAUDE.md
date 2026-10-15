# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project snapshot

REST API for personal finance management. **Express 4 + TypeScript (strict) + Prisma 5 + PostgreSQL.** Auth via JWT with DB-backed blacklist. Dockerized for staging/prod, deployed to Railway with a managed Postgres (Prisma Cloud) external DB.

Current Prisma models: `User`, `Account`, `Transaction`, `Budget`, `IncomeItem`, `ExpenseItem`, `BlacklistedToken`. An earlier "gamification" module was removed (see migration `20260119000139_remove_gamification_models`) — if you see leftover references to badges, achievements, levels, coins, or experience anywhere in the code, they're dead and safe to delete.

## Common commands

```bash
# Local dev (tsx hot-reload, reads .env)
yarn dev                    # one-shot
yarn dev:watch              # restart on file change

# Quality gates
yarn type-check             # tsc --noEmit (strict — see TS notes below)
yarn lint                   # eslint
yarn lint:fix
yarn test                   # vitest (run once)
yarn test:ui                # vitest UI
yarn test:coverage          # v8 coverage

# Run a single test file
yarn test path/to/file.test.ts
# Run tests matching a name pattern
yarn test -t "creates a transaction"

# Build & start (production-ish, locally)
yarn build                  # tsc → dist/
yarn start                  # node dist/server.js

# Prisma
yarn prisma generate        # regenerate client after schema changes
yarn prisma migrate dev     # create + apply a new migration locally
yarn prisma migrate deploy  # apply existing migrations (used in CI/Railway pre-deploy)
yarn prisma studio          # GUI to browse the DB
DATABASE_URL="..." yarn prisma studio   # browse a remote DB ad-hoc

# OpenAPI / client generation
yarn export:schema          # dump openapi-schema.json
yarn generate:client        # also regenerate src/types/openapi.d.ts

# Docker (base + override pattern)
yarn compose:dev            # auto-loads docker-compose.override.yml
yarn compose:dev:tools      # + pgAdmin at :5050 (profile=tools)
yarn compose:staging        # -f staging.yml, --env-file .env.staging
yarn compose:prod           # -f prod.yml,    --env-file .env.production
yarn compose:logs           # tail api logs
yarn compose:prod:down      # tear down prod stack
```

## Architecture — the layers

Strict 4-layer separation. Don't shortcut layers (controllers must not touch Prisma; services must not touch `req`/`res`).

```
HTTP request
  ↓
src/routes/*.ts            mount paths, attach validators + auth, bind controller methods
  ↓
src/controllers/*.ts       parse req, call services, shape HTTP response, map errors → status codes
  ↓
src/services/*.ts          business logic, orchestrate repositories, throw typed errors
  ↓
src/repositories/*.ts      Prisma queries, extend BaseRepository<T> for generic CRUD
  ↓
PostgreSQL (via Prisma client from src/config/database.ts)
```

### Conventions when adding a new resource

For a "Foo" resource, add these files in lockstep:
1. `prisma/schema.prisma` — model + migration (`yarn prisma migrate dev --name add_foo`)
2. `src/repositories/foo.repository.ts` — `class FooRepository extends BaseRepository<Foo>` + any custom Prisma queries; export a singleton `fooRepository`
3. `src/services/foo.service.ts` — class with the business logic, exported singleton `fooService`; throw typed errors (see below), not raw `Error`
4. `src/dto/request/foo.dto.ts` and `src/dto/response/foo.dto.ts` — TypeScript types for inputs/outputs. **DTOs are barely adopted** — only `auth` and `user` have them; `account`, `budget`, `transaction` keep inline types in `src/types/<feature>.types.ts`. The DTO folder is the intended direction, but matching the existing per-feature `*.types.ts` pattern is also acceptable if you're extending an existing resource
5. `src/validators/foo.validator.ts` — `express-validator` chains, one named export per endpoint
6. `src/controllers/foo.controller.ts` — class with one method per route; bind in routes file
7. `src/routes/foo.ts` — wire `authenticateJWT` (from `src/middleware/auth.ts`) + validators + `validate` middleware + controller methods
8. `src/routes/index.ts` — mount `router.use('/foo', fooRoutes)`

### Base repository quirks

`src/repositories/base.repository.ts` uses `prisma[modelName]` indexing with `@ts-expect-error`. **The `modelName` string MUST match the Prisma model name with a lowercase first letter** (e.g. `'user'`, `'transaction'`). Mismatch = silent runtime crash. The base class loses strong typing through this indirection — repositories that need typed queries should write them out longhand rather than relying on the base methods.

### `transactionIncludes` pattern

`src/repositories/transaction.repository.ts` exports a `transactionIncludes` constant used by both repo and service to keep Prisma `include:` clauses consistent across queries. Follow this pattern when other models start having similar relational fan-outs — don't inline `include:` blocks scattered everywhere.

### Errors

- **All expected errors extend `AppError`** (`src/errors/AppError.ts`), which carries `statusCode` + a stable `errorCode`. Domain errors live in `src/errors/DomainErrors.ts` (accounts, budgets, items, transactions), auth errors in `src/errors/AuthErrors.ts` (`AuthError` is now just a subclass of `AppError`, kept for compatibility), import errors in `src/errors/XlsxImportErrors.ts`. Services throw these — **never `throw new Error('...')` for an expected outcome, and never string-match error messages in controllers.**
- **Controllers forward every error with `catch (error) { next(error); }`** — Express 4 doesn't catch async rejections by itself. No controller builds its own error response.
- The global `errorHandler` (`src/middleware/errorHandler.ts`) is the ONE place that renders errors, in this order:
  1. `AppError` subclasses → their `statusCode` and `errorCode`
  2. `Prisma.PrismaClientKnownRequestError` → `P2002` → 409, `P2003` → 400, `P2025` → 404, `P2000` → 400
  3. `Prisma.PrismaClientValidationError` → 400
  4. Express/body-parser 4xx (malformed JSON, payload too large) → their status, message only if `expose`
  5. Anything else → 500, message and stack **hidden outside development**
- **Error envelope** (also documented as `components.schemas.Error` in `swagger.config.ts`):
  `{ success: false, message, error, errorCode }` — `message` and `error` carry the same text (two keys for compatibility with older clients). Validation failures from `validate` add `errorCode: 'VALIDATION_ERROR'` and `errors: [{ field, message }]`.
- **Ownership → 404**: a resource that belongs to another user is indistinguishable from a missing one (`BudgetNotFoundError`, …). An ID referenced in the request *body* that isn't the caller's → 400 `INVALID_ACCOUNT_REFERENCE` / `INVALID_BUDGET_ITEM_REFERENCE`. Check ownership **before** state rules (e.g. "account has transactions" → 409) so error codes can't be used as an existence oracle.
- For 401 on auth flows: **`InvalidCredentialsError` is thrown both for "user not found" and "wrong password"** — intentional, don't leak which one to clients.

### Auth flow

- JWT in `Authorization: Bearer <token>` header, **HS256 only** (pinned on sign and verify via `JWT_ALGORITHM` in `src/config/env.ts`).
- Middleware `authenticateJWT` lives in `src/middleware/auth.ts`. Order: header → DB-backed blacklist (`isTokenBlacklisted`, so logout invalidates tokens) → signature/expiry → user exists + active → token `sid` matches `User.sessionId` (single active session; mismatch → **440 `SESSION_REVOKED`**, a status reserved for this). Failures are forwarded as typed errors.
- Decoded JWT payload is stuffed on `req.user` and typed as `AuthenticatedRequest` from `src/types/index.ts`.
- **Secrets have no defaults.** `getJwtSecret()` throws if `JWT_SECRET` is unset, and `assertRequiredEnv()` (called first thing in `startServer`) refuses to boot without `JWT_SECRET` / `DATABASE_URL`. Never add `process.env.X ?? 'fallback'` for a secret.
  - Gotcha when testing this locally: Prisma's client loads `.env` on import, so unsetting the var in your shell isn't enough — set it to an empty string (`JWT_SECRET= node dist/server.js`).
- Passwords: bcrypt cost 12 for new hashes; register requires 8–72 bytes and **does not trim**. Login compares the raw password first and falls back to the trimmed one for accounts created under the old "trim" rule.
- `/auth/login` and `/auth/register` have an extra `authRateLimiter` (`src/middleware/rateLimiters.ts`, 10 failed attempts / 15 min per IP by default) on top of the global `/api/` limiter.

### HTTP hardening (in `server.ts`)

- JSON body limit is `100kb` (`JSON_BODY_LIMIT`); only `/api/transactions/import/*` gets `10mb` (`IMPORT_JSON_BODY_LIMIT`). File uploads go through multer, not the JSON parser.
- Swagger UI, `/api-docs.json`, `/api/schema.json` and `/api/docs` are served only when `isApiDocsEnabled()` — on by default outside production, **off in production** unless `ENABLE_API_DOCS=true`. If codegen points at staging and staging runs with `NODE_ENV=production`, set `ENABLE_API_DOCS=true` there.

## TypeScript strictness — known gotchas

`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noEmitOnError`. Two recurring patterns this forces:

1. **`req.params` destructuring** yields `string | undefined` for every field. Controllers cast at the destructure to avoid `string | undefined` errors when passing to services:
   ```ts
   const { id } = req.params as { id: string };
   const { id, expenseId } = req.params as { id: string; expenseId: string };
   ```
   `yarn dev` (tsx) silently ignores these; `yarn build` / `yarn type-check` will fail. **Always run `yarn type-check` before committing.**

2. **Path aliases** (`@/*`, `@/types/*`, etc.) are defined in `tsconfig.json` and mirrored in `vitest.config.ts` but **almost never used** — at the time of writing, exactly one file (`src/utils/response.ts`) imports via `@/`. Everything else uses relative imports like `../services/foo.service`. Stick with relative imports unless you're refactoring with intent.

3. **ESLint uses `tsconfig.eslint.json`**, which extends `tsconfig.json` but also includes test files (the build tsconfig excludes `*.test.ts` so they never land in `dist/`). Generated `src/types/openapi.d.ts` is in ESLint's `ignorePatterns`.

## Database & migrations

- One Prisma client instance lives in `src/config/database.ts` and is imported wherever needed (don't `new PrismaClient()` again).
- `binaryTargets` in `schema.prisma` covers macOS (`native`), x86_64 Linux containers (`debian-openssl-3.0.x`), and ARM64 (`linux-arm64-openssl-3.0.x` — needed for Apple Silicon Docker builds and AWS Graviton). If you add a new deploy target with a different libc/openssl, add its target here or runtime will fail with "Could not locate the Query Engine".
- Production/staging **do not run migrations on container start** — Railway runs `npx prisma migrate deploy` as a pre-deploy step (`railway.json`). Dockerfile `CMD` is just `node dist/server.js`. Keep it that way: running migrations on start race-conditions across replicas.

## Docker / deploy

- **Single Dockerfile** for all environments. The image stage `production` is what runs in staging and prod; environments differ only by `.env.*` + `docker-compose.*.yml` overrides. **Don't add per-env Dockerfiles.**
- **4-stage build**: `deps` (full install, cached via BuildKit mount) → `builder` (compile TS + `prisma generate`) → `pruned` (re-install with `--production` to drop dev deps) → `production` (slim runtime). Order of `COPY --from=pruned` then `COPY --from=builder /app/node_modules/.prisma` matters — Prisma client artifacts must overlay the pruned node_modules.
- **Compose base + override**: `docker-compose.yml` is the shared base; `docker-compose.override.yml` auto-loads for dev (hot-reload via volume mount); `docker-compose.staging.yml` and `docker-compose.prod.yml` disable the embedded `postgres` service (managed DB) and tune resources.
- **Railway**: `railway.json` pins the Dockerfile builder, `/health` healthcheck, `ON_FAILURE` restart with 5 max retries, and `preDeployCommand` for migrations. Variables (incl. `DATABASE_URL`, `JWT_SECRET`, `TRUST_PROXY_HOPS=1`) live in the Railway dashboard, not in files.

## Reverse proxy gotcha

When behind Railway/Render/Nginx, set env var `TRUST_PROXY_HOPS=1` (or `2` if Cloudflare is in front). `src/server.ts` reads this and calls `app.set('trust proxy', N)` — without it, `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and every request gets bucketed under the proxy's single IP. Never use `app.set('trust proxy', true)` — clients can spoof their IP.

## macOS-on-USB workaround (specific to current workspace)

This repo currently lives on `/Volumes/KINGSTON` (exFAT). macOS writes `._*` AppleDouble sidecar files there that crash Docker BuildKit ("failed to xattr"). The `compose:*` yarn scripts run `dot_clean -m .` and set `COPYFILE_DISABLE=1` to work around this. If you ever move the project to an APFS volume (recommended), the `clean:macos` step becomes dead weight and can be removed from the scripts.

## Environment files

| File | Committed? | Purpose |
|---|---|---|
| `env.example` | ✅ | Template for local `.env` |
| `env.staging.example` | ✅ | Template for `.env.staging` |
| `env.test` | ✅ | Safe test defaults |
| `.env` | ❌ gitignored | Local dev |
| `.env.staging`, `.env.production` | ❌ gitignored | Real secrets per env |

Production secrets should live in the platform's secret manager (Railway dashboard), not in checked-out files.

## Testing notes

- **Vitest**, setup at `src/tests/setup.ts`. The setup file silences console output and forces `NODE_ENV=test`, a dummy `JWT_SECRET`, and a default `DATABASE_URL` pointing at `gamification_finances_test` on localhost.
- No real test DB is wired up yet; tests don't currently hit Postgres. When adding integration tests, point `DATABASE_URL` at a dedicated test database (never reuse dev/staging/prod) and pick a strategy — transactional rollback per test, schema-per-test-run, or full reset between suites.

## Things to verify before declaring a backend change "done"

1. `yarn type-check` passes (catches the `req.params` traps and other strict-mode regressions tsx hides)
2. `yarn lint` passes
3. If schema changed: migration created, `yarn prisma generate` run, types updated in DTOs
4. If API surface changed: OpenAPI schema regenerated (`yarn export:schema`) and `openapi-schema.json` committed
5. New endpoints have a `validate` middleware + `authenticateJWT` (unless explicitly public like `/auth/login`); every `:id` is `isUUID()`-validated and list endpoints cap `limit` at 100
6. `yarn test` passes; new business/ownership rules have tests (see `src/tests/security/` for the ownership, auth-middleware and error-handler patterns)
7. `yarn audit --groups dependencies --level high` is clean (CI enforces it)

CI (`.github/workflows/ci.yml`) runs type-check, lint, tests, build, the runtime-dependency audit and gitleaks on every push/PR.

## Project skills

`.claude/skills/` holds the project's rules as Claude Code skills — `backend-architecture` (layers, toolchain, decisions), `backend-api-design`, `backend-data-practices`, `backend-security`, `backend-new-resource` (scaffold + templates) and `backend-code-review` (checklist). Keep them in sync with this file when conventions change.
