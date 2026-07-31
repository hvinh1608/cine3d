ALTER TABLE "User" ADD COLUMN "vipStartsAt" TIMESTAMP(3);

CREATE INDEX "User_vipStartsAt_idx" ON "User"("vipStartsAt");
