CREATE TABLE "ActorFollow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActorFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActorFollow_userId_actorId_key" ON "ActorFollow"("userId", "actorId");
CREATE INDEX "ActorFollow_actorId_idx" ON "ActorFollow"("actorId");
ALTER TABLE "ActorFollow" ADD CONSTRAINT "ActorFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActorFollow" ADD CONSTRAINT "ActorFollow_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DirectorFollow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "directorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectorFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DirectorFollow_userId_directorId_key" ON "DirectorFollow"("userId", "directorId");
CREATE INDEX "DirectorFollow_directorId_idx" ON "DirectorFollow"("directorId");
ALTER TABLE "DirectorFollow" ADD CONSTRAINT "DirectorFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectorFollow" ADD CONSTRAINT "DirectorFollow_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "Director"("id") ON DELETE CASCADE ON UPDATE CASCADE;
