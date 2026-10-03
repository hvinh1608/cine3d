-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'ALL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "targeted" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDelivery" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_createdAt_idx" ON "MarketingCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingCampaign_createdById_createdAt_idx" ON "MarketingCampaign"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingCampaign_segment_createdAt_idx" ON "MarketingCampaign"("segment", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingDelivery_campaignId_status_idx" ON "MarketingDelivery"("campaignId", "status");

-- CreateIndex
CREATE INDEX "MarketingDelivery_userId_createdAt_idx" ON "MarketingDelivery"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDelivery_campaignId_userId_channel_key" ON "MarketingDelivery"("campaignId", "userId", "channel");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDelivery" ADD CONSTRAINT "MarketingDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDelivery" ADD CONSTRAINT "MarketingDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
