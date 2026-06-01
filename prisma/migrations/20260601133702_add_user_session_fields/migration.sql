-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "sessionLastActivityAt" TIMESTAMP(3);
