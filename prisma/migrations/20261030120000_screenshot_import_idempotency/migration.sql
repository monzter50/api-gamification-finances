-- Screenshot import idempotency (plan "idempotencia en el import de
-- transacciones", phase 1).
--
-- EXPAND step: every new Transaction column is nullable (or has a default) so
-- the previous app version keeps inserting rows during a rolling deploy. The
-- app now writes `occurredAt` on every path; a later CONTRACT migration can make
-- it NOT NULL once no NULLs remain.
--
-- `fingerprint` gets a NON-unique index on purpose: two identical purchases in
-- the same minute are legitimate. Idempotency comes from reconciling counts per
-- fingerprint inside the import (see services/screenshotImport), not from a
-- constraint. `ImportImage (userId, sha256)` IS unique: the same screenshot is
-- never imported twice.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "descriptorNorm" TEXT,
ADD COLUMN     "fingerprint" CHAR(64),
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMPTZ(3),
ADD COLUMN     "rawDescriptor" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inserted" INTEGER NOT NULL,
    "skippedAsDuplicate" INTEGER NOT NULL,
    "skippedImages" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "batchId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportImage_batchId_idx" ON "ImportImage"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportImage_userId_sha256_key" ON "ImportImage"("userId", "sha256");

-- CreateIndex
CREATE INDEX "Transaction_userId_fingerprint_idx" ON "Transaction"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill (historic rows). `date` holds a calendar day at 00:00 UTC; the
-- movement's real time was never captured, so per the plan history gets
-- 00:00 *local* time: that day at midnight in America/Cancun (UTC-5, no DST).
-- Casting the timestamp to ::date first keeps the session TimeZone out of it.
UPDATE "Transaction"
SET "occurredAt"    = ("date"::date)::timestamp AT TIME ZONE 'America/Cancun',
    "rawDescriptor" = "vendor",
    "source"        = CASE WHEN "importHash" IS NOT NULL THEN 'xlsx' ELSE 'manual' END;

-- Must match normDescriptor() in src/services/screenshotImport/fingerprint.ts:
-- NFD, strip combining marks, lowercase, keep only [a-z0-9].
UPDATE "Transaction"
SET "descriptorNorm" = regexp_replace(
      lower(regexp_replace(normalize("rawDescriptor", NFD), '[̀-ͯ]', '', 'g')),
      '[^a-z0-9]', '', 'g');

-- Must match fingerprintOf() in the same file.
UPDATE "Transaction"
SET "fingerprint" = encode(sha256(convert_to(concat_ws('|',
      "userId",
      "accountId",
      to_char("occurredAt" AT TIME ZONE 'America/Cancun', 'YYYY-MM-DD"T"HH24:MI'),
      "amountCents"::text,
      "type",
      "descriptorNorm"), 'UTF8')), 'hex');
