-- CreateTable
CREATE TABLE "QrLoginSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrLoginSession_tokenHash_key" ON "QrLoginSession"("tokenHash");

-- CreateIndex
CREATE INDEX "QrLoginSession_expiresAt_status_idx" ON "QrLoginSession"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "QrLoginSession_userId_createdAt_idx" ON "QrLoginSession"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "QrLoginSession" ADD CONSTRAINT "QrLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
