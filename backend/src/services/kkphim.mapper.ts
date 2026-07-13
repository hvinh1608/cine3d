import { absoluteImageUrl, DEFAULT_CDN } from './kkphim.client';

export type AppVideoSource = {
  id: string;
  server: string;
  quality: string;
  url: string;
  type: 'hls' | 'mp4';
};

export type AppEpisode = {
  id: string;
  title: string;
  episodeOrder: number;
  videoSources: AppVideoSource[];
};

export type AppMovie = {
  id: string;
  title: string;
  englishTitle: string | null;
  slug: string;
  description: string;
  backdropUrl: string;
  posterUrl: string;
  trailerUrl: string | null;
  releaseYear: number;
  duration: number;
  quality: string;
  episodeCount: number;
  isSeries: boolean;
  status: string;
  views: number;
  ratingAvg: number;
  isFeatured: boolean;
  isTrending: boolean;
  isProposed: boolean;
  isVip?: boolean;
  requiresVip?: boolean;
  country: { name: string; slug: string } | null;
  movieGenres: { genre: { name: string; slug: string } }[];
  movieActors: { actor: { name: string } }[];
  movieDirectors: { director: { name: string } }[];
  episodes: AppEpisode[];
  kkphimId?: string;
};

function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseDuration(time?: string | null): number {
  if (!time) return 0;
  const match = String(time).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function parseEpisodeCount(total?: string | number | null): number {
  if (!total) return 1;
  const str = String(total).toLowerCase();
  const matches = str.match(/\d+/g);
  if (matches && matches.length > 0) {
    return parseInt(matches[matches.length - 1], 10);
  }
  return 1;
}

function mapStatus(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s.includes('ongoing') || s.includes('updating') || s === 'ongoing') return 'Ongoing';
  if (s.includes('trailer') || s.includes('upcoming')) return 'Upcoming';
  return 'Completed';
}

function isSeriesType(type?: string | null): boolean {
  const t = (type || '').toLowerCase();
  return t === 'series' || t === 'hoathinh' || t === 'tvshows' || t === 'tv-shows';
}

function parseEpisodeOrder(name: string, index: number): number {
  const lower = name.toLowerCase();
  if (lower === 'full' || lower.includes('full')) return 1;
  const match = name.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  return index + 1;
}

function resolveCdn(cdn?: string | null): string {
  return cdn || DEFAULT_CDN;
}

/** Map a list/search item (no full episodes). */
export function mapListItem(item: any, cdn?: string): AppMovie {
  const imgCdn = resolveCdn(cdn);
  const poster = absoluteImageUrl(item.poster_url, imgCdn);
  const thumb = absoluteImageUrl(item.thumb_url, imgCdn) || poster;
  const vote = item.tmdb?.vote_average || item.imdb?.vote_average || 0;

  return {
    id: item.slug || item._id,
    title: item.name || '',
    englishTitle: item.origin_name || null,
    slug: item.slug,
    description: stripHtml(item.content) || item.origin_name || '',
    backdropUrl: thumb,
    posterUrl: poster || thumb,
    trailerUrl: item.trailer_url || null,
    releaseYear: item.year || 0,
    duration: parseDuration(item.time),
    quality: item.quality || 'HD',
    episodeCount: parseEpisodeCount(item.episode_total || item.episode_current),
    isSeries: isSeriesType(item.type),
    status: mapStatus(item.status || item.episode_current),
    views: item.view || 0,
    ratingAvg: typeof vote === 'number' ? vote : 0,
    isFeatured: false,
    isTrending: false,
    isProposed: false,
    country: item.country?.[0]
      ? { name: item.country[0].name, slug: item.country[0].slug }
      : null,
    movieGenres: (item.category || []).map((c: any) => ({
      genre: { name: c.name, slug: c.slug },
    })),
    movieActors: [],
    movieDirectors: [],
    episodes: [],
    kkphimId: item._id,
  };
}

/** Merge multi-server episode lists into app episodes with videoSources. */
export function mapEpisodes(servers: any[] = [], quality = 'FHD'): AppEpisode[] {
  const byKey = new Map<string, AppEpisode>();

  servers.forEach((server) => {
    const serverName = server.server_name || 'Server';
    const data: any[] = server.server_data || [];

    data.forEach((ep, index) => {
      const key = ep.slug || ep.name || `ep-${index + 1}`;
      const order = parseEpisodeOrder(ep.name || '', index);
      const url = ep.link_m3u8 || '';
      if (!url) return;

      if (!byKey.has(key)) {
        byKey.set(key, {
          id: key,
          title: ep.name || `Tập ${order}`,
          episodeOrder: order,
          videoSources: [],
        });
      }

      const entry = byKey.get(key)!;
      entry.videoSources.push({
        id: `${key}-${serverName}`,
        server: serverName,
        quality,
        url,
        type: 'hls',
      });
    });
  });

  return Array.from(byKey.values()).sort((a, b) => a.episodeOrder - b.episodeOrder);
}

/** Map full movie detail response `{ movie, episodes }`. */
export function mapMovieDetail(payload: any, cdn?: string): AppMovie {
  const movie = payload.movie || payload;
  const imgCdn = resolveCdn(cdn);
  const base = mapListItem(movie, imgCdn);
  const episodes = mapEpisodes(payload.episodes || [], movie.quality || 'FHD');

  return {
    ...base,
    description: stripHtml(movie.content) || base.description,
    backdropUrl: absoluteImageUrl(movie.thumb_url, imgCdn) || base.backdropUrl,
    posterUrl: absoluteImageUrl(movie.poster_url, imgCdn) || base.posterUrl,
    trailerUrl: movie.trailer_url || null,
    duration: parseDuration(movie.time) || base.duration,
    episodeCount: episodes.length || parseEpisodeCount(movie.episode_total),
    isSeries: isSeriesType(movie.type) || episodes.length > 1,
    status: mapStatus(movie.status),
    views: movie.view || 0,
    movieActors: (movie.actor || [])
      .filter((name: string) => name && name !== 'null')
      .map((name: string) => ({ actor: { name } })),
    movieDirectors: (movie.director || [])
      .filter((name: string) => name && name !== 'null')
      .map((name: string) => ({ director: { name } })),
    episodes,
  };
}

export function extractListPagination(raw: any): {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  cdn: string;
} {
  // Flat new-updates shape
  if (Array.isArray(raw.items) && raw.pagination) {
    return {
      items: raw.items,
      total: raw.pagination.totalItems || raw.items.length,
      page: raw.pagination.currentPage || 1,
      limit: raw.pagination.totalItemsPerPage || raw.items.length,
      totalPages: raw.pagination.totalPages || 1,
      cdn: DEFAULT_CDN,
    };
  }

  // v1 nested shape
  const data = raw.data || raw;
  const pagination = data.params?.pagination || data.pagination || {};
  const items = data.items || [];
  return {
    items,
    total: pagination.totalItems || items.length,
    page: pagination.currentPage || 1,
    limit: pagination.totalItemsPerPage || items.length || 24,
    totalPages: pagination.totalPages || 1,
    cdn: data.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN,
  };
}

export function extractMetaItems(raw: any): { name: string; slug: string }[] {
  const items = raw?.data?.items || raw?.items || [];
  return items.map((item: any) => ({
    name: item.name,
    slug: item.slug,
  }));
}
