export type VipVideoSource = {
  isPremium?: boolean;
  quality?: string;
  healthStatus?: string;
  consecutiveFailures?: number;
  [key: string]: unknown;
};

export function sourceRequiresVip(source: VipVideoSource): boolean {
  return !!source.isPremium || /(?:2k|4k|1440p?|2160p?)/i.test(source.quality || '');
}

export function shapeMovieForViewer(movie: any, canAccessVip: boolean, now = new Date()) {
  const earlyAccessUntil = movie.vipEarlyAccessUntil ? new Date(movie.vipEarlyAccessUntil) : null;
  const isEarlyAccess = !!earlyAccessUntil
    && !Number.isNaN(earlyAccessUntil.getTime())
    && earlyAccessUntil.getTime() > now.getTime();
  const wholeMovieRequiresVip = !!movie.isVip || isEarlyAccess;

  return {
    ...movie,
    isEarlyAccess,
    requiresVip: wholeMovieRequiresVip && !canAccessVip,
    episodes: (movie.episodes || []).map((episode: any) => {
      const allSources: VipVideoSource[] = (episode.videoSources || []).map((source: VipVideoSource) => ({
        ...source,
        // 2K/4K are always treated as Premium, even when an older DB row lacks the flag.
        isPremium: sourceRequiresVip(source),
      }));
      const usableSources = allSources.filter((source) => source.healthStatus !== 'failed' || Number(source.consecutiveFailures || 0) < 3);
      // Never make an episode unplayable solely because every background health check failed.
      const sources = usableSources.length ? usableSources : allSources;
      const premiumCount = sources.filter(sourceRequiresVip).length;
      const videoSources = canAccessVip
        ? [...sources].sort((a, b) => Number(sourceRequiresVip(b)) - Number(sourceRequiresVip(a)))
        : wholeMovieRequiresVip
          ? []
          : sources.filter((source: VipVideoSource) => !sourceRequiresVip(source));

      return {
        ...episode,
        videoSources,
        premiumSourcesLocked: canAccessVip ? 0 : (wholeMovieRequiresVip ? sources.length : premiumCount),
      };
    }),
  };
}
