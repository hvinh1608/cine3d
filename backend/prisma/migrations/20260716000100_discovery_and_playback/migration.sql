ALTER TABLE "Movie" ADD COLUMN "isDubbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Episode" ADD COLUMN "seasonNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Episode" ADD COLUMN "airDate" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "isSpoiler" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN "timestampSeconds" INTEGER;

CREATE INDEX "Episode_movieId_seasonNumber_episodeOrder_idx" ON "Episode"("movieId", "seasonNumber", "episodeOrder");
CREATE INDEX "Episode_airDate_idx" ON "Episode"("airDate");
