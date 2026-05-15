import express from 'express';
import { accountController } from '../controllers/account.controller';
import { authenticateJWT } from './auth';
import { validate } from '../middleware/validate';
import {
  createAccountValidation,
  updateAccountValidation,
  accountIdValidation
} from '../validators/account.validator';

const router = express.Router();

// GET /api/accounts
router.get(
  '/',
  authenticateJWT,
  accountController.getUserAccounts.bind(accountController)
);

// POST /api/accounts
router.post(
  '/',
  authenticateJWT,
  createAccountValidation,
  validate,
  accountController.createAccount.bind(accountController)
);

// GET /api/accounts/:id
router.get(
  '/:id',
  authenticateJWT,
  accountIdValidation,
  validate,
  accountController.getAccountById.bind(accountController)
);

// PUT /api/accounts/:id
router.put(
  '/:id',
  authenticateJWT,
  accountIdValidation,
  updateAccountValidation,
  validate,
  accountController.updateAccount.bind(accountController)
);

// DELETE /api/accounts/:id
router.delete(
  '/:id',
  authenticateJWT,
  accountIdValidation,
  validate,
  accountController.deleteAccount.bind(accountController)
);

export { router as accountRoutes };
