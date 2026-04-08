/*
  Warnings:

  - You are about to drop the column `category` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isInstallment` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `owner` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Transaction_userId_category_idx";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "category",
DROP COLUMN "isInstallment",
DROP COLUMN "owner";
