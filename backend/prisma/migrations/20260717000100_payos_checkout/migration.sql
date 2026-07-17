ALTER TABLE "VipOrder"
ADD COLUMN "providerOrderCode" TEXT,
ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "paymentQrCode" TEXT;

CREATE UNIQUE INDEX "VipOrder_providerOrderCode_key" ON "VipOrder"("providerOrderCode");
