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
7. `src/routes/foo.ts` — wire validators + `validate` middleware + `authenticateJWT` + controller methods
8. `src/routes/index.ts` — mount `router.use('/foo', fooRoutes)`

### Base repository quirks

`src/repositories/base.repository.ts` uses `prisma[modelName]` indexing with `@ts-expect-error`. **The `modelName` string MUST match the Prisma model name with a lowercase first letter** (e.g. `'user'`, `'transaction'`). Mismatch = silent runtime crash. The base class loses strong typing through this indirection — repositories that need typed queries should write them out longhand rather than relying on the base methods.

### `transactionIncludes` pattern

`src/repositories/transaction.repository.ts` exports a `transactionIncludes` constant used by both repo and service to keep Prisma `include:` clauses consistent across queries. Follow this pattern when other models start having similar relational fan-outs — don't inline `include:` blocks scattered everywhere.

### Errors

- Custom errors live in `src/errors/AuthErrors.ts` and extend a base `AuthError` that carries `statusCode` + `errorCode`. Despite the filename, the base class is generic — reuse it (or split into per-domain error files) when you need typed errors outside of auth.
- The global `errorHandler` (`src/middleware/errorHandler.ts`) handles, in this order:
  1. `AuthError` subclasses → uses their `statusCode` and `errorCode`
  2. `Prisma.PrismaClientKnownRequestError` → maps known codes (`P2002` → 409, `P2003` → 400, `P2025` → 404, `P2000` → 400)
  3. `Prisma.PrismaClientValidationError` → 400
  4. JWT errors (`JsonWebTokenError`, `TokenExpiredError`) → 401
  5. Anything else → 500, with the raw `err.message` **hidden in non-dev** environments
- Many controllers ALSO do `if (error instanceof AuthError)` checks themselves and return early. Both paths produce the same response; new controllers can lean on the global handler instead of duplicating the check, but match the existing style if you're editing a file that already does it both ways.
- For 401 on auth flows: **`InvalidCredentialsError` is thrown both for "user not found" and "wrong password"** — intentional, don't leak which one to clients.

### Auth flow

- JWT in `Authorization: Bearer <token>` header.
- Middleware `authenticateJWT` is defined inline in `src/routes/auth.ts` (not in `src/middleware/`). It checks DB-backed blacklist via `isTokenBlacklisted` before verifying the JWT, so logout actually invalidates tokens.
- Decoded JWT payload is stuffed on `req.user` and typed as `AuthenticatedRequest` from `src/types/index.ts`.
- `JWT_SECRET` defaults to `'default_secret'` if env var is missing — **a fail-open default is risky**, treat changing this as a follow-up.

## TypeScript strictness — known gotchas

`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noEmitOnError`. Two recurring patterns this forces:

1. **`req.params` destructuring** yields `string | undefined` for every field. Controllers cast at the destructure to avoid `string | undefined` errors when passing to services:
   ```ts
   const { id } = req.params as { id: string };
   const { id, expenseId } = req.params as { id: string; expenseId: string };
   ```
   `yarn dev` (tsx) silently ignores these; `yarn build` / `yarn type-check` will fail. **Always run `yarn type-check` before committing.**

2. **Path aliases** (`@/*`, `@/types/*`, etc.) are defined in `tsconfig.json` and mirrored in `vitest.config.ts` but **almost never used** — at the time of writing, exactly one file (`src/utils/response.ts`) imports via `@/`. Everything else uses relative imports like `../services/foo.service`. Stick with relative imports unless you're refactoring with intent.

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
5. New endpoints have a `validate` middleware + `authenticateJWT` (unless explicitly public like `/auth/login`)
