-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "BlacklistedToken_token_idx" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "BlacklistedToken_userId_idx" ON "BlacklistedToken"("userId");

-- CreateIndex
CREATE INDEX "BlacklistedToken_token_userId_idx" ON "BlacklistedToken"("token", "userId");

-- CreateIndex
CREATE INDEX "BlacklistedToken_expiresAt_idx" ON "BlacklistedToken"("expiresAt");
