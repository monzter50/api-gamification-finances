-- Migration: Make IncomeItem.accountId required.
--
-- Rationale: "Planning income without a destination account is meaningless"
-- (see docs/transactions-api.md). Before this migration, accountId was
-- nullable and the FK had ON DELETE SET NULL; after, it is NOT NULL and the
-- FK uses ON DELETE RESTRICT so accounts with attached income items cannot
-- be deleted silently.
--
-- Data migration strategy (safe for environments that may contain rows with
-- accountId IS NULL):
--   1. For any user who has income items but NO accounts, create a default
--      "Default" checking account so we have somewhere to attach orphans.
--   2. Backfill every NULL accountId on IncomeItem to the user's oldest
--      account (joined via Budget.userId).
--   3. Drop the old nullable FK, set the column NOT NULL, re-add the FK
--      with ON DELETE RESTRICT.

-- Step 1: ensure every user with null-account income items has at least
-- one account to attach them to.
INSERT INTO "Account" (id, "userId", name, type, balance, currency, "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  'Default',
  'checking',
  0,
  'MXN',
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE EXISTS (
  SELECT 1
  FROM "IncomeItem" i
  JOIN "Budget" b ON i."budgetId" = b.id
  WHERE b."userId" = u.id
    AND i."accountId" IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."userId" = u.id
);

-- Step 2: backfill NULL accountIds to the owning user's oldest account.
UPDATE "IncomeItem" i
SET "accountId" = (
  SELECT a.id
  FROM "Account" a
  JOIN "Budget" b ON b."userId" = a."userId"
  WHERE b.id = i."budgetId"
  ORDER BY a."createdAt" ASC
  LIMIT 1
)
WHERE i."accountId" IS NULL;

-- Step 3: drop the old FK (was ON DELETE SET NULL), set NOT NULL, re-add FK.
ALTER TABLE "IncomeItem" DROP CONSTRAINT IF EXISTS "IncomeItem_accountId_fkey";

ALTER TABLE "IncomeItem" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "IncomeItem"
  ADD CONSTRAINT "IncomeItem_accountId_fkey"
  FOREIGN KEY ("accountId")
  REFERENCES "Account"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
