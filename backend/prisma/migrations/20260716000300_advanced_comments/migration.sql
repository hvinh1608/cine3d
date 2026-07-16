ALTER TABLE "Comment" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "Comment_movieId_parentId_createdAt_idx";
CREATE INDEX "Comment_movieId_parentId_isPinned_createdAt_idx" ON "Comment"("movieId", "parentId", "isPinned", "createdAt");
