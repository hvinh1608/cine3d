ALTER TABLE "VideoSource"
ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "lastStatusCode" INTEGER,
ADD COLUMN "lastResponseTimeMs" INTEGER,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "VideoSource_healthStatus_lastCheckedAt_idx" ON "VideoSource"("healthStatus", "lastCheckedAt");
