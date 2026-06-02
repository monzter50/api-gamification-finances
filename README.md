# API Gamification Finances

REST API for personal finance management (budgets, accounts, transactions). Built with **Node.js + Express + TypeScript + Prisma + PostgreSQL**.

For architecture conventions and contributor guidance, see [`CLAUDE.md`](./CLAUDE.md).

## Requirements

- Node.js ≥ 18
- PostgreSQL (local container, Prisma Cloud, or any managed Postgres)
- Yarn (project uses `yarn.lock`)
- Docker + Docker Compose (optional, for the containerized workflow)

## Quick start

```bash
# 1. Install deps
yarn install

# 2. Configure environment
cp env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET

# 3. Apply migrations
yarn prisma migrate deploy

# 4. Run in dev mode (hot reload)
yarn dev:watch
```

The server starts on `http://localhost:3000`. Health check at `/health`, OpenAPI docs at `/api-docs`.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. Use `?sslmode=require` for managed DBs |
| `JWT_SECRET` | ✅ | Symmetric secret for signing JWTs |
| `JWT_EXPIRES_IN` |  | Default `7d` |
| `SESSION_INACTIVITY_WINDOW_MIN` |  | Default `20`. Single-active-session window — a new login is blocked while an existing session has been active within this many minutes (see [Authentication & sessions](#authentication--sessions)) |
| `PORT` |  | Default `3000`. Set by Railway/Render automatically |
| `NODE_ENV` |  | `development` / `staging` / `production` / `test` |
| `CORS_ORIGIN` |  | Comma-separated list. Default `http://localhost:3000` |
| `TRUST_PROXY_HOPS` |  | `1` behind Railway/Render, `2` if Cloudflare is in front. Never `true` |
| `RATE_LIMIT_WINDOW_MS` |  | Default `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` |  | Default `100` per window per IP |
| `LOG_LEVEL` |  | `debug` / `info` / `warn` / `error` |

Templates: `env.example` (local), `env.staging.example`, `env.test` (committed). Real `.env*` files are gitignored.

## Scripts

```bash
yarn dev / dev:watch          # local dev (tsx)
yarn build / start            # compile to dist/, then run

yarn type-check               # strict tsc --noEmit (catches things tsx hides)
yarn lint / lint:fix          # eslint
yarn test / test:ui / test:coverage   # vitest

yarn prisma migrate dev       # create + apply a new migration
yarn prisma migrate deploy    # apply existing migrations (CI/prod)
yarn prisma studio            # GUI DB browser

yarn export:schema            # dump openapi-schema.json
yarn generate:client          # also regenerate src/types/openapi.d.ts

# Docker (base + override pattern)
yarn compose:dev              # local stack with hot reload
yarn compose:staging          # built image + .env.staging + external DB
yarn compose:prod             # built image + .env.production + external DB
yarn compose:logs             # tail api logs
```

## API surface

All routes mounted under `/api`. Auth endpoints are public; everything else requires `Authorization: Bearer <token>`.

| Group | Path | Notes |
|---|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` | DB-backed JWT blacklist on logout + [single active session](#authentication--sessions) |
| Users | `/users/...` | Profile + user-scoped operations |
| Accounts | `/accounts/...` | Checking / savings / credit_card / vales |
| Budgets | `/budgets/...` | Monthly budgets with income + expense items |
| Transactions | `/transactions/...` | Linked to accounts and budgets; mutating one rebalances the others |

Full route list is enumerated at `GET /api/docs` (returns JSON) and rendered at `/api-docs` (Swagger UI).

## Authentication & sessions

Auth is JWT-based (`Authorization: Bearer <token>`) with **single active session per user** — a user can only be signed in on one device at a time.

**How it works**

- Each `User` has a `sessionId` and `sessionLastActivityAt`. On login a fresh `sessionId` is generated and embedded in the JWT as the `sid` claim.
- `authenticateJWT` rejects any token whose `sid` no longer matches the user's current `sessionId` (i.e. a newer login superseded it).
- A session counts as **active** only while it has been used within `SESSION_INACTIVITY_WINDOW_MIN` (default 20 min). Once idle past that window, a new login is allowed again — this prevents permanent lockout when a user closes the app without logging out. The window slides forward on each authenticated request (throttled to ~1 write/min).
- Logout clears the session (and blacklists the token), freeing the slot immediately.

**Error contract** — the status code is the signal (a thin client can branch on it without parsing the body):

| Scenario | HTTP | `errorCode` |
|---|---|---|
| Login while another session is active | `409` | `SESSION_ALREADY_ACTIVE` |
| Request with a token superseded by a newer login | `440` | `SESSION_REVOKED` |
| Token blacklisted (after logout) | `401` | `TOKEN_BLACKLISTED` |
| Malformed / expired token | `401` | `INVALID_TOKEN` |
| Deactivated account | `403` | `ACCOUNT_DEACTIVATED` |

## Project layout

```
src/
├── config/         # Prisma client, logger, Swagger setup
├── controllers/    # HTTP layer — parse req, call services, shape res
├── services/       # Business logic — orchestrate repositories
├── repositories/   # Prisma queries — extend BaseRepository<T>
├── dto/            # Request/response shapes (partial adoption: auth + user)
├── validators/     # express-validator chains
├── middleware/     # errorHandler, validate
├── errors/         # Typed application errors (AuthError + subclasses)
├── routes/         # Route definitions
├── types/          # Shared types (JWTPayload, AuthenticatedRequest, ApiResponse)
├── tests/          # Vitest setup
└── server.ts       # Entry point

prisma/
├── schema.prisma   # Source of truth for the data model
└── migrations/     # Versioned SQL migrations
```

See [`CLAUDE.md`](./CLAUDE.md) for the conventions around adding a new resource, the `BaseRepository` gotchas, strict-TypeScript patterns, and deployment notes.

## Docker

A single `Dockerfile` (multi-stage: `deps` → `builder` → `pruned` → `production`) is used for all deployed environments. Per-environment behavior is driven by compose overrides + env files — there is no `Dockerfile.staging` or `Dockerfile.prod`.

| File | Purpose |
|---|---|
| `docker-compose.yml` | Shared base — api + postgres |
| `docker-compose.override.yml` | Auto-loaded for `yarn compose:dev` — hot reload, source mount |
| `docker-compose.staging.yml` | Staging overrides — disables embedded Postgres (managed DB) |
| `docker-compose.prod.yml` | Production overrides — single replica, resource limits, `on-failure` restart |
| `railway.json` | Railway deployment config — `Dockerfile` builder + `prisma migrate deploy` as pre-deploy |

## Deployment

Configured for **Railway**:

1. Connect this repo in the Railway dashboard.
2. Variables → paste the relevant entries from `env.production.example` (`DATABASE_URL`, `JWT_SECRET`, `TRUST_PROXY_HOPS=1`, etc.).
3. Add a Postgres plugin (auto-injects `DATABASE_URL`) **or** use an external managed DB (e.g. Prisma Cloud).
4. Push to your tracked branch — Railway builds from the Dockerfile, runs `npx prisma migrate deploy`, then starts the container.
5. Settings → Networking → Generate Domain.

Same pattern works on Render, Fly.io, Heroku, or any platform that builds from a Dockerfile and injects env vars.

## License

MIT
