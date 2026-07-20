CREATE TABLE "NativeDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceModel" TEXT,
    "appVersion" TEXT,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NativeDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseToken" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL,
    "expiryTime" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DownloadEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DownloadEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppVersionPolicy" (
    "platform" TEXT NOT NULL,
    "minVersion" TEXT NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "storeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppVersionPolicy_pkey" PRIMARY KEY ("platform")
);

CREATE UNIQUE INDEX "NativeDevice_fcmToken_key" ON "NativeDevice"("fcmToken");
CREATE UNIQUE INDEX "NativeDevice_userId_deviceId_key" ON "NativeDevice"("userId", "deviceId");
CREATE INDEX "NativeDevice_userId_updatedAt_idx" ON "NativeDevice"("userId", "updatedAt");
CREATE INDEX "NativeDevice_platform_idx" ON "NativeDevice"("platform");
CREATE UNIQUE INDEX "PlayPurchase_purchaseToken_key" ON "PlayPurchase"("purchaseToken");
CREATE UNIQUE INDEX "PlayPurchase_orderId_key" ON "PlayPurchase"("orderId");
CREATE INDEX "PlayPurchase_userId_createdAt_idx" ON "PlayPurchase"("userId", "createdAt");
CREATE INDEX "PlayPurchase_planId_idx" ON "PlayPurchase"("planId");
CREATE INDEX "PlayPurchase_status_expiryTime_idx" ON "PlayPurchase"("status", "expiryTime");
CREATE INDEX "PlayPurchase_productId_idx" ON "PlayPurchase"("productId");
CREATE UNIQUE INDEX "DownloadEntitlement_tokenHash_key" ON "DownloadEntitlement"("tokenHash");
CREATE INDEX "DownloadEntitlement_userId_expiresAt_idx" ON "DownloadEntitlement"("userId", "expiresAt");
CREATE INDEX "DownloadEntitlement_episodeId_idx" ON "DownloadEntitlement"("episodeId");
CREATE INDEX "DownloadEntitlement_sourceId_idx" ON "DownloadEntitlement"("sourceId");
CREATE INDEX "DownloadEntitlement_expiresAt_idx" ON "DownloadEntitlement"("expiresAt");

ALTER TABLE "NativeDevice" ADD CONSTRAINT "NativeDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayPurchase" ADD CONSTRAINT "PlayPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayPurchase" ADD CONSTRAINT "PlayPurchase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DownloadEntitlement" ADD CONSTRAINT "DownloadEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadEntitlement" ADD CONSTRAINT "DownloadEntitlement_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadEntitlement" ADD CONSTRAINT "DownloadEntitlement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VideoSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
