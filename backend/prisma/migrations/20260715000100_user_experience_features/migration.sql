-- Player metadata and device session information
ALTER TABLE "Episode"
ADD COLUMN "introEndSeconds" INTEGER,
ADD COLUMN "outroStartSeconds" INTEGER;

ALTER TABLE "RefreshToken"
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Follow a movie to receive new episode notifications
CREATE TABLE "MovieFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovieFollow_pkey" PRIMARY KEY ("id")
);

-- User-created movie collections
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- Multiple viewing profiles per account
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "isKids" BOOLEAN NOT NULL DEFAULT false,
    "pinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileFavorite" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileWatchlist" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileWatchlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileWatchHistory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "episodeId" TEXT,
    "watchedTime" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileWatchHistory_pkey" PRIMARY KEY ("id")
);

-- Browser push notifications and lightweight product analytics
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "movieId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovieFollow_userId_movieId_key" ON "MovieFollow"("userId", "movieId");
CREATE INDEX "MovieFollow_movieId_createdAt_idx" ON "MovieFollow"("movieId", "createdAt");
CREATE INDEX "Playlist_userId_updatedAt_idx" ON "Playlist"("userId", "updatedAt");
CREATE UNIQUE INDEX "PlaylistItem_playlistId_movieId_key" ON "PlaylistItem"("playlistId", "movieId");
CREATE INDEX "PlaylistItem_playlistId_position_idx" ON "PlaylistItem"("playlistId", "position");
CREATE INDEX "PlaylistItem_movieId_idx" ON "PlaylistItem"("movieId");
CREATE INDEX "UserProfile_userId_createdAt_idx" ON "UserProfile"("userId", "createdAt");
CREATE UNIQUE INDEX "ProfileFavorite_profileId_movieId_key" ON "ProfileFavorite"("profileId", "movieId");
CREATE INDEX "ProfileFavorite_profileId_createdAt_idx" ON "ProfileFavorite"("profileId", "createdAt");
CREATE UNIQUE INDEX "ProfileWatchlist_profileId_movieId_key" ON "ProfileWatchlist"("profileId", "movieId");
CREATE INDEX "ProfileWatchlist_profileId_createdAt_idx" ON "ProfileWatchlist"("profileId", "createdAt");
CREATE UNIQUE INDEX "ProfileWatchHistory_profileId_movieId_key" ON "ProfileWatchHistory"("profileId", "movieId");
CREATE INDEX "ProfileWatchHistory_profileId_updatedAt_idx" ON "ProfileWatchHistory"("profileId", "updatedAt");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");
CREATE INDEX "AnalyticsEvent_movieId_createdAt_idx" ON "AnalyticsEvent"("movieId", "createdAt");

ALTER TABLE "MovieFollow" ADD CONSTRAINT "MovieFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieFollow" ADD CONSTRAINT "MovieFollow_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileFavorite" ADD CONSTRAINT "ProfileFavorite_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileFavorite" ADD CONSTRAINT "ProfileFavorite_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileWatchlist" ADD CONSTRAINT "ProfileWatchlist_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileWatchlist" ADD CONSTRAINT "ProfileWatchlist_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileWatchHistory" ADD CONSTRAINT "ProfileWatchHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileWatchHistory" ADD CONSTRAINT "ProfileWatchHistory_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileWatchHistory" ADD CONSTRAINT "ProfileWatchHistory_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
