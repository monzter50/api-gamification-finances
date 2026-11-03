---
name: backend-new-resource
description: >
  Step-by-step workflow to add a new resource or endpoint to this Express + Prisma API
  across all layers — Prisma model + migration, repository, service, typed errors,
  types/DTOs, express-validator chains, controller, routes, route mounting, OpenAPI docs,
  and tests — then run the quality gates. Use this skill whenever the user asks to add,
  create, scaffold, or implement a new endpoint, resource, model, CRUD, route, feature
  module, or import source (e.g. "add categories", "I need an endpoint to...", "create a
  goals module", "add PATCH /accounts/:id/archive"), even if they only mention one layer.
---

# Add a new resource / endpoint

Layers are strict (see CLAUDE.md): routes → controllers → services → repositories →
Prisma. Controllers never touch Prisma; services never touch `req`/`res`.

Before writing code, skim the sibling skills when relevant:
- `backend-api-design` — paths, status codes, envelope, pagination, money in the contract
- `backend-data-practices` — schema, indexes, migrations, `$transaction`, ownership scoping

Copy-paste skeletons for every file are in `references/templates.md`. Use them as the
starting point; they already satisfy the repo's strict TS flags and ESLint rules.

## Workflow

Work through these in order. Steps that don't apply (e.g. endpoint on an existing
resource needs no model) can be skipped — say so explicitly in your summary.

### 0. Design first (2 minutes, in your head or in chat)
Write down: endpoints (method + path), request fields + validation, response shape,
every error case with status + `errorCode`, and whether anything moves money. If the
request is ambiguous on any of these and the choice is user-visible, ask once.

### 1. Schema + migration (`prisma/schema.prisma`)
- Model with `id` uuid, `userId` + relation + index, `createdAt`, `updatedAt`; back-relation
  on `User`. Money as `Int` cents.
- `yarn prisma migrate dev --name add_foo` → review the generated SQL → `yarn prisma generate`.

### 2. Errors (`src/errors/FooErrors.ts`)
- One class per failure the client must distinguish, extending `AppError`
  (`src/errors/AppError.ts`) — add them to `src/errors/DomainErrors.ts` or a
  `FooErrors.ts`. Gives the global `errorHandler` a `statusCode` and stable `errorCode`.
- Never `throw new Error('Foo not found')` for an expected outcome, and never string-match
  messages in a controller.

### 3. Repository (`src/repositories/foo.repository.ts`)
- `extends BaseRepository<Foo>`, `super('foo')` — **exact lowercase model name**.
- Ownership-scoped methods: `findByUser`, `findByIdAndUser`, `updateByIdAndUser`,
  `deleteByIdAndUser`. Use `prisma.foo` directly for typed queries.
- Whitelist updatable columns; never pass the request body straight into `data`.
- Export singleton `fooRepository`. If it has relational fan-out, export a
  `fooIncludes` constant (like `transactionIncludes`).

### 4. Types (`src/types/foo.types.ts` or `src/dto/{request,response}/foo.dto.ts`)
- New resource → prefer DTOs (the intended direction). Extending an existing resource →
  match its `*.types.ts`.
- Request body types, a union type for enum-like strings, and a shared `const` array
  that feeds both the type and the validator.
- Under `exactOptionalPropertyTypes`, build optional fields conditionally
  (`if (x !== undefined) data.x = x`) rather than assigning `undefined`.

### 5. Service (`src/services/foo.service.ts`)
- Business rules, ownership checks for referenced IDs, orchestration, `$transaction` for
  multi-write invariants. Throw typed errors. Return domain objects, not HTTP shapes.
- Export singleton `fooService`.

### 6. Validators (`src/validators/foo.validator.ts`)
- One named export per endpoint: `createFooValidation`, `updateFooValidation`,
  `fooIdValidation`, `fooQueryValidation`.
- Every param (`isUUID`), every body field (type, `trim`, length max, `isIn`, numeric
  ranges), every query param (`page`/`limit` with a max). Optional fields use `.optional()`.

### 7. Controller (`src/controllers/foo.controller.ts`)
- One method per route; `(req, res, next)`; parse input, call service, send envelope,
  `catch (error) { next(error) }`. Express 4 does **not** forward async rejections by
  itself — without the try/catch + `next`, a thrown error hangs the request.
- Don't call `validationResult` again — the `validate` middleware already did.
- Params: `const { id } = req.params as { id: string };`
- Export singleton `fooController`.

### 8. Routes (`src/routes/foo.ts`) and mount (`src/routes/index.ts`)
- Order per route: `authenticateJWT` (from `../middleware/auth`), validators, `validate`, `controller.method.bind(controller)`.
- `authenticateJWT` = app session only. Use `authenticateUserOrApiToken` only if personal API tokens (MCP, scripts) should reach the endpoint — then update the snapshot in `src/tests/apiTokens/routeExposure.test.ts`.
- Static paths above `/:id`.
- `@openapi` JSDoc block per endpoint.
- Mount: `router.use('/foos', fooRoutes);` — also add it to the `/docs` endpoint list if
  you're keeping that in sync.

### 9. Tests (`src/tests/<feature>/*.test.ts`)
- Unit-test the service with mocked repositories (pattern in `references/templates.md`).
  Cover: happy path, not-owned → not-found error, each business rule, and for money: the
  exact cents values written.
- Extract pure rules into functions and test them directly.

### 10. Quality gates (don't skip — tsx hides type errors)
```bash
yarn type-check && yarn lint && yarn test
yarn export:schema   # if the API surface changed; commit openapi-schema.json
```
Fix everything before reporting done.

## Done means
Summarize for the user: files created/changed, endpoints with status codes, migration
name (and whether it's safe for a rolling deploy), test coverage added, gate results,
and any follow-ups you noticed but deliberately didn't do.
