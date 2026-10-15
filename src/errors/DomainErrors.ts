import { AppError } from './AppError';

/**
 * Domain errors for accounts, budgets, budget items and transactions.
 *
 * Conventions:
 *  - A resource addressed by the URL that doesn't exist OR isn't owned by the
 *    caller → 404 `<RESOURCE>_NOT_FOUND` (never 403: it would confirm the ID
 *    exists for someone else).
 *  - A resource referenced from the request BODY that doesn't exist / isn't
 *    owned → 400 `INVALID_<RESOURCE>_REFERENCE`.
 *  - Business-rule violations → 400/409 with a specific code.
 */

// ---- Accounts -------------------------------------------------------------

export class AccountNotFoundError extends AppError {
  constructor (message: string = 'Account not found') {
    super(message, 404, 'ACCOUNT_NOT_FOUND');
  }
}

export class InvalidAccountReferenceError extends AppError {
  constructor (accountId?: string) {
    super(
      accountId !== undefined ? `Account ${accountId} not found` : 'Account not found',
      400,
      'INVALID_ACCOUNT_REFERENCE'
    );
  }
}

export class AccountHasTransactionsError extends AppError {
  constructor (message: string = 'Cannot delete account with existing transactions') {
    super(message, 409, 'ACCOUNT_HAS_TRANSACTIONS');
  }
}

// ---- Budgets --------------------------------------------------------------

export class BudgetNotFoundError extends AppError {
  constructor (message: string = 'Budget not found') {
    super(message, 404, 'BUDGET_NOT_FOUND');
  }
}

export class BudgetAlreadyExistsError extends AppError {
  /** `month` is 0-based (as stored); the message shows it 1-based. */
  constructor (year: number, month: number) {
    super(`Budget for ${year}-${month + 1} already exists`, 409, 'BUDGET_ALREADY_EXISTS');
  }
}

export class InvalidMonthError extends AppError {
  constructor (message: string = 'Month must be between 0 and 11') {
    super(message, 400, 'INVALID_MONTH');
  }
}

export class StaleAccountReferencesError extends AppError {
  constructor (accountIds: string[]) {
    super(
      `Cannot duplicate: source budget references account(s) that no longer belong to user: ${accountIds.join(', ')}`,
      400,
      'STALE_ACCOUNT_REFERENCES'
    );
  }
}

// ---- Budget items -----------------------------------------------------------

export class IncomeItemNotFoundError extends AppError {
  constructor (message: string = 'Income item not found') {
    super(message, 404, 'INCOME_ITEM_NOT_FOUND');
  }
}

export class ExpenseItemNotFoundError extends AppError {
  constructor (message: string = 'Expense item not found') {
    super(message, 404, 'EXPENSE_ITEM_NOT_FOUND');
  }
}

/** Item payload failed a business validation (description/amount/type...). */
export class InvalidBudgetItemError extends AppError {
  constructor (message: string) {
    super(message, 400, 'INVALID_BUDGET_ITEM');
  }
}

/** A transaction references an income/expense item that isn't in its budget. */
export class InvalidBudgetItemReferenceError extends AppError {
  constructor (message: string) {
    super(message, 400, 'INVALID_BUDGET_ITEM_REFERENCE');
  }
}

// ---- Transactions -----------------------------------------------------------

export class TransactionNotFoundError extends AppError {
  constructor (message: string = 'Transaction not found') {
    super(message, 404, 'TRANSACTION_NOT_FOUND');
  }
}

export class IncomeLimitExceededError extends AppError {
  constructor (message: string) {
    super(message, 400, 'INCOME_LIMIT_EXCEEDED');
  }
}

export class UnsupportedTransactionTypeError extends AppError {
  constructor (type: string) {
    super(
      `Unsupported transaction type "${type}" for balance update. Expected 'income' or 'expense'.`,
      400,
      'UNSUPPORTED_TRANSACTION_TYPE'
    );
  }
}
