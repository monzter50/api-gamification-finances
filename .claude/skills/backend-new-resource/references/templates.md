# Templates for a new resource

Replace `Foo`/`foo`/`foos`/`FOO` with the resource name. Example fields: `name`, `kind`,
`targetCents`. Delete what you don't need. Formatting follows `eslint.config.mjs` (neostandard + semicolons)
(2 spaces, single quotes, semicolons, space before function parens, no trailing commas).

## Contents
1. Prisma model
2. Errors
3. Repository
4. Types
5. Service
6. Validators
7. Controller
8. Routes (+ OpenAPI)
9. Service test

---

## 1. Prisma model

```prisma
model Foo {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  kind        String   // 'a' | 'b' | 'c'
  targetCents Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
}

// in model User:
//   foos Foo[]
```

## 2. Errors — `src/errors/FooErrors.ts`

```ts
import { AppError } from './AppError';

/**
 * Foo errors. Extend `AppError` (statusCode + errorCode) so the global
 * errorHandler maps them automatically.
 */
export class FooNotFoundError extends AppError {
  constructor (message: string = 'Foo not found') {
    super(message, 404, 'FOO_NOT_FOUND');
  }
}

export class FooAlreadyExistsError extends AppError {
  constructor (message: string = 'A foo with this name already exists') {
    super(message, 409, 'FOO_ALREADY_EXISTS');
  }
}
```

## 3. Repository — `src/repositories/foo.repository.ts`

```ts
import { type Foo, type Prisma } from '@prisma/client';
import prisma from '../config/database';
import { BaseRepository } from './base.repository';

export class FooRepository extends BaseRepository<Foo> {
  constructor () {
    super('foo'); // MUST equal the Prisma model name, lowercase first letter
  }

  async findByUser (userId: string, page: number, limit: number): Promise<{ data: Foo[], total: number }> {
    const where: Prisma.FooWhereInput = { userId };
    const [data, total] = await Promise.all([
      prisma.foo.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.foo.count({ where })
    ]);
    return { data, total };
  }

  async findByIdAndUser (id: string, userId: string): Promise<Foo | null> {
    return await prisma.foo.findFirst({ where: { id, userId } });
  }

  async createForUser (userId: string, data: { name: string, kind: string, targetCents: number }): Promise<Foo> {
    return await prisma.foo.create({ data: { ...data, userId } });
  }

  /** Returns null when the row doesn't exist for this user. */
  async updateByIdAndUser (id: string, userId: string, data: Prisma.FooUpdateInput): Promise<Foo | null> {
    const exists = await this.findByIdAndUser(id, userId);
    if (exists === null) return null;
    return await prisma.foo.update({ where: { id }, data });
  }

  async deleteByIdAndUser (id: string, userId: string): Promise<Foo | null> {
    const exists = await this.findByIdAndUser(id, userId);
    if (exists === null) return null;
    return await prisma.foo.delete({ where: { id } });
  }
}

export const fooRepository = new FooRepository();
```

## 4. Types — `src/dto/request/foo.dto.ts`

```ts
export const FOO_KINDS = ['a', 'b', 'c'] as const;
export type FooKind = typeof FOO_KINDS[number];

export interface CreateFooBody {
  name: string
  kind: FooKind
  /** Decimal currency units in the HTTP contract; stored as cents. */
  target?: number
}

export interface UpdateFooBody {
  name?: string
  kind?: FooKind
  target?: number
  isActive?: boolean
}
```

`src/dto/response/foo.dto.ts`:

```ts
import { type Foo } from '@prisma/client';
import { fromCents } from '../../utils/money';

export interface FooResponse {
  id: string
  name: string
  kind: string
  target: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** Never leak storage-only columns (userId, *Cents) to the client. */
export const toFooResponse = (foo: Foo): FooResponse => ({
  id: foo.id,
  name: foo.name,
  kind: foo.kind,
  target: fromCents(foo.targetCents),
  isActive: foo.isActive,
  createdAt: foo.createdAt,
  updatedAt: foo.updatedAt
});
```

## 5. Service — `src/services/foo.service.ts`

```ts
import { type Prisma } from '@prisma/client';
import { fooRepository } from '../repositories/foo.repository';
import { FooNotFoundError } from '../errors/FooErrors';
import { toCents } from '../utils/money';
import { toFooResponse, type FooResponse } from '../dto/response/foo.dto';
import { type CreateFooBody, type UpdateFooBody } from '../dto/request/foo.dto';

export class FooService {
  async list (userId: string, page: number, limit: number): Promise<{ data: FooResponse[], total: number }> {
    const { data, total } = await fooRepository.findByUser(userId, page, limit);
    return { data: data.map(toFooResponse), total };
  }

  async getById (id: string, userId: string): Promise<FooResponse> {
    const foo = await fooRepository.findByIdAndUser(id, userId);
    if (foo === null) throw new FooNotFoundError();
    return toFooResponse(foo);
  }

  async create (userId: string, body: CreateFooBody): Promise<FooResponse> {
    const foo = await fooRepository.createForUser(userId, {
      name: body.name,
      kind: body.kind,
      targetCents: toCents(body.target ?? 0)
    });
    return toFooResponse(foo);
  }

  async update (id: string, userId: string, body: UpdateFooBody): Promise<FooResponse> {
    // Whitelist: only editable columns, built conditionally (exactOptionalPropertyTypes).
    const data: Prisma.FooUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.kind !== undefined) data.kind = body.kind;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.target !== undefined) data.targetCents = toCents(body.target);

    const foo = await fooRepository.updateByIdAndUser(id, userId, data);
    if (foo === null) throw new FooNotFoundError();
    return toFooResponse(foo);
  }

  async remove (id: string, userId: string): Promise<FooResponse> {
    // Ownership first, THEN any state rules (e.g. "has dependents" → 409),
    // so a 409 never reveals another user's row exists.
    const foo = await fooRepository.deleteByIdAndUser(id, userId);
    if (foo === null) throw new FooNotFoundError();
    return toFooResponse(foo);
  }
}

export const fooService = new FooService();
```

If the operation writes several rows that must stay consistent (or moves money), wrap
the writes in `prisma.$transaction(async (tx) => { ... })` in the service and use `tx`
for every write inside.

## 6. Validators — `src/validators/foo.validator.ts`

```ts
import { body, param, query } from 'express-validator';
import { FOO_KINDS } from '../dto/request/foo.dto';

export const fooIdValidation = [
  param('id').isUUID().withMessage('Foo ID must be a valid UUID')
];

export const listFooValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

export const createFooValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
  body('kind').isIn([...FOO_KINDS]).withMessage(`Kind must be one of: ${FOO_KINDS.join(', ')}`),
  body('target').optional().isFloat({ min: 0 }).withMessage('Target must be a non-negative number')
];

export const updateFooValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name must not be empty')
    .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
  body('kind').optional().isIn([...FOO_KINDS]).withMessage(`Kind must be one of: ${FOO_KINDS.join(', ')}`),
  body('target').optional().isFloat({ min: 0 }).withMessage('Target must be a non-negative number'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];
```

## 7. Controller — `src/controllers/foo.controller.ts`

```ts
import { type Response, type NextFunction } from 'express';
import { type AuthenticatedRequest } from '../types';
import { fooService } from '../services/foo.service';
import { type CreateFooBody, type UpdateFooBody } from '../dto/request/foo.dto';

/**
 * Errors are forwarded with next(error); the global errorHandler maps typed
 * errors (AppError subclasses) and Prisma errors to status codes, and hides
 * internals on 500. Express 4 does not catch async rejections on its own.
 */
export class FooController {
  async list (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = req.query.page !== undefined ? Number(req.query.page) : 1;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : 10;
      const { data, total } = await fooService.list(userId, page, limit);
      res.status(200).json({
        success: true,
        message: 'Foos retrieved successfully',
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const foo = await fooService.getById(id, req.user!.userId);
      res.status(200).json({ success: true, message: 'Foo retrieved successfully', data: foo });
    } catch (error) {
      next(error);
    }
  }

  async create (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const foo = await fooService.create(req.user!.userId, req.body as CreateFooBody);
      res.status(201).json({ success: true, message: 'Foo created successfully', data: foo });
    } catch (error) {
      next(error);
    }
  }

  async update (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const foo = await fooService.update(id, req.user!.userId, req.body as UpdateFooBody);
      res.status(200).json({ success: true, message: 'Foo updated successfully', data: foo });
    } catch (error) {
      next(error);
    }
  }

  async remove (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const foo = await fooService.remove(id, req.user!.userId);
      res.status(200).json({ success: true, message: 'Foo deleted successfully', data: foo });
    } catch (error) {
      next(error);
    }
  }
}

export const fooController = new FooController();
```

## 8. Routes — `src/routes/foos.ts`

```ts
import express from 'express';
import { fooController } from '../controllers/foo.controller';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  fooIdValidation,
  listFooValidation,
  createFooValidation,
  updateFooValidation
} from '../validators/foo.validator';

const router = express.Router();

/**
 * @openapi
 * /api/foos:
 *   get:
 *     tags: [Foos]
 *     summary: List the caller's foos (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *     responses:
 *       200: { description: Paginated list of foos }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
router.get('/', authenticateJWT, listFooValidation, validate, fooController.list.bind(fooController));

// Static sub-paths go HERE, above '/:id'.

router.get('/:id', authenticateJWT, fooIdValidation, validate, fooController.getById.bind(fooController));
router.post('/', authenticateJWT, createFooValidation, validate, fooController.create.bind(fooController));
router.put('/:id', authenticateJWT, fooIdValidation, updateFooValidation, validate, fooController.update.bind(fooController));
router.delete('/:id', authenticateJWT, fooIdValidation, validate, fooController.remove.bind(fooController));

export { router as fooRoutes };
```

Mount in `src/routes/index.ts`:

```ts
import { fooRoutes } from './foos';
// ...
router.use('/foos', fooRoutes);
```

## 9. Service test — `src/tests/foo/fooService.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/foo.repository', () => ({
  fooRepository: {
    findByUser: vi.fn(),
    findByIdAndUser: vi.fn(),
    createForUser: vi.fn(),
    updateByIdAndUser: vi.fn(),
    deleteByIdAndUser: vi.fn()
  }
}));

import { fooService } from '../../services/foo.service';
import { fooRepository } from '../../repositories/foo.repository';
import { FooNotFoundError } from '../../errors/FooErrors';

const USER = 'user-1';
const row = {
  id: 'foo-1', userId: USER, name: 'Emergency fund', kind: 'a',
  targetCents: 1234550, isActive: true, createdAt: new Date(), updatedAt: new Date()
};

beforeEach(() => { vi.clearAllMocks(); });

describe('FooService', () => {
  it('stores the target in cents and returns decimals', async () => {
    vi.mocked(fooRepository.createForUser).mockResolvedValue(row as never);
    const result = await fooService.create(USER, { name: 'Emergency fund', kind: 'a', target: 12345.5 });
    expect(fooRepository.createForUser).toHaveBeenCalledWith(USER, expect.objectContaining({ targetCents: 1234550 }));
    expect(result.target).toBe(12345.5);
    expect(result).not.toHaveProperty('userId');
  });

  it('treats another user\'s foo as not found', async () => {
    vi.mocked(fooRepository.findByIdAndUser).mockResolvedValue(null);
    await expect(fooService.getById('foo-1', 'someone-else')).rejects.toBeInstanceOf(FooNotFoundError);
  });
});
```
