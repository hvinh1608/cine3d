ALTER TABLE "Episode" ADD COLUMN "releaseNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Episode_airDate_releaseNotifiedAt_idx" ON "Episode"("airDate", "releaseNotifiedAt");
