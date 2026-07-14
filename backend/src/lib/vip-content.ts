export type VipVideoSource = {
  isPremium?: boolean;
  quality?: string;
  [key: string]: unknown;
};

export function sourceRequiresVip(source: VipVideoSource): boolean {
  return !!source.isPremium || /(?:4k|2160p?)/i.test(source.quality || '');
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
      const sources: VipVideoSource[] = (episode.videoSources || []).map((source: VipVideoSource) => ({
        ...source,
        // 4K is always treated as Premium, even when an older DB row lacks the flag.
        isPremium: sourceRequiresVip(source),
      }));
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
