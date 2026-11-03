-- Phase 1 of the finance-rules plan.
--
-- 1.3 Money in integer cents — EXPAND step. The new *Cents columns are added,
--     backfilled from the Float columns and then made NOT NULL. The Float
--     columns stay (and keep being written) until a later CONTRACT migration
--     drops them, once the sums have been verified to match.
-- 1.4 Idempotent Excel import — `importHash`, unique per user.
-- 1.5 'Credit Card' is debt, not income — existing rows move to 'Transfer'.

-- AlterTable: Account
ALTER TABLE "Account" ADD COLUMN "balanceCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Account" SET "balanceCents" = ROUND(("balance" * 100)::numeric);

-- AlterTable: Transaction
ALTER TABLE "Transaction"
  ADD COLUMN "amountCents" INTEGER,
  ADD COLUMN "installmentOriginalCents" INTEGER,
  ADD COLUMN "importHash" TEXT;
UPDATE "Transaction"
  SET "amountCents" = ROUND(("amount" * 100)::numeric),
      "installmentOriginalCents" = ROUND(("installmentOriginal" * 100)::numeric);
ALTER TABLE "Transaction" ALTER COLUMN "amountCents" SET NOT NULL;

-- AlterTable: IncomeItem
ALTER TABLE "IncomeItem" ADD COLUMN "amountCents" INTEGER;
UPDATE "IncomeItem" SET "amountCents" = ROUND(("amount" * 100)::numeric);
ALTER TABLE "IncomeItem" ALTER COLUMN "amountCents" SET NOT NULL;

-- AlterTable: ExpenseItem
ALTER TABLE "ExpenseItem" ADD COLUMN "amountCents" INTEGER;
UPDATE "ExpenseItem" SET "amountCents" = ROUND(("amount" * 100)::numeric);
ALTER TABLE "ExpenseItem" ALTER COLUMN "amountCents" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_importHash_key" ON "Transaction"("userId", "importHash");

-- Data: a credit card is debt, not an income type.
UPDATE "IncomeItem" SET "type" = 'Transfer' WHERE "type" = 'Credit Card';
