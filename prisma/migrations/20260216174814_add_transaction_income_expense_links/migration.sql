-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "expenseItemId" TEXT,
ADD COLUMN     "incomeItemId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_incomeItemId_idx" ON "Transaction"("incomeItemId");

-- CreateIndex
CREATE INDEX "Transaction_expenseItemId_idx" ON "Transaction"("expenseItemId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_incomeItemId_fkey" FOREIGN KEY ("incomeItemId") REFERENCES "IncomeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_expenseItemId_fkey" FOREIGN KEY ("expenseItemId") REFERENCES "ExpenseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
