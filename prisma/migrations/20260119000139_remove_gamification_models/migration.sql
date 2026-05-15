/*
  Warnings:

  - You are about to drop the `Achievement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Badge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserWallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AchievementToUserProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_BadgeToUserProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserProgress" DROP CONSTRAINT "UserProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserWallet" DROP CONSTRAINT "UserWallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "_AchievementToUserProgress" DROP CONSTRAINT "_AchievementToUserProgress_A_fkey";

-- DropForeignKey
ALTER TABLE "_AchievementToUserProgress" DROP CONSTRAINT "_AchievementToUserProgress_B_fkey";

-- DropForeignKey
ALTER TABLE "_BadgeToUserProgress" DROP CONSTRAINT "_BadgeToUserProgress_A_fkey";

-- DropForeignKey
ALTER TABLE "_BadgeToUserProgress" DROP CONSTRAINT "_BadgeToUserProgress_B_fkey";

-- DropTable
DROP TABLE "Achievement";

-- DropTable
DROP TABLE "Badge";

-- DropTable
DROP TABLE "UserProfile";

-- DropTable
DROP TABLE "UserProgress";

-- DropTable
DROP TABLE "UserWallet";

-- DropTable
DROP TABLE "_AchievementToUserProgress";

-- DropTable
DROP TABLE "_BadgeToUserProgress";
