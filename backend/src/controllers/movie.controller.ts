import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  fetchNewMovies,
  fetchMovieList,
  fetchKkphimHome,
  searchMovies,
  fetchMovieDetail,
  KkphimError,
} from '../services/kkphim.client';
import { mapListItem, mapMovieDetail, extractListPagination, resolveSortLang } from '../services/kkphim.mapper';
import { ensureMovieInDb, mapStoredMovie } from '../services/movie.upsert';
import { internalError, isStorageFullError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { shapeMovieForViewer } from '../lib/vip-content';
import { smartSearchScore } from '../lib/smart-search';
import { cacheGet, cacheSet } from '../lib/cache';


function resolveTypeList(type?: string): string {
  if (type === 'series') return 'phim-bo';
  if (type === 'movie') return 'phim-le';
  if (type === 'hoathinh' || type === 'anime') return 'hoat-hinh';
  if (type === 'tvshows' || type === 'tv') return 'tv-shows';
  return 'phim-le';
}

const storedListInclude = {
  country: true,
  movieGenres: { include: { genre: true } },
  movieActors: { include: { actor: true } },
  movieDirectors: { include: { director: true } },
};
let lastCatalogFallbackWarningAt = 0;

function warnCatalogFallback() {
  const now = Date.now();
  if (now - lastCatalogFallbackWarningAt < 60_000) return;
  lastCatalogFallbackWarningAt = now;
  console.warn('KKPhim unavailable; serving catalog data from database.');
}

async function getStoredMoviePage(query: Request['query']) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(64, Math.max(1, parseInt(String(query.limit || '24'), 10) || 24));
  const search = String(query.search || '').trim();
  const type = String(query.type || '');
  const genre = String(query.genre || '');
  const country = String(query.country || '');
  const year = parseInt(String(query.year || ''), 10);
  const status = String(query.status || '');
  const where: any = {};

  if (search) where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { englishTitle: { contains: search, mode: 'insensitive' } },
    { slug: { contains: search, mode: 'insensitive' } },
    { movieActors: { some: { actor: { name: { contains: search, mode: 'insensitive' } } } } },
    { movieDirectors: { some: { director: { name: { contains: search, mode: 'insensitive' } } } } },
  ];
  const requestedGenre = genre || ((type === 'hoathinh' || type === 'anime') ? 'hoat-hinh' : '');
  if (requestedGenre) where.movieGenres = { some: { genre: { slug: requestedGenre } } };
  if (country) where.country = { slug: country };
  if (Number.isFinite(year)) where.releaseYear = year;
  if (type === 'series') where.isSeries = true;
  if (type === 'movie') where.isSeries = false;
  if (status) where.status = { equals: status, mode: 'insensitive' };
  if (query.vip === 'true') where.isVip = true;
  if (query.vip === 'false') where.isVip = false;
  if (query.dubbed === 'true') where.isDubbed = true;

  const orderBy = query.sortBy === 'views'
    ? { views: 'desc' as const }
    : query.sortBy === 'ratingAvg'
      ? { ratingAvg: 'desc' as const }
      : { updatedAt: 'desc' as const };
  const [total, stored] = await prisma.$transaction([
    prisma.movie.count({ where }),
    prisma.movie.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: storedListInclude,
    }),
  ]);
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    movies: stored.map(mapStoredMovie),
    partial: true,
    source: 'database',
  };
}

async function viewerCanAccessVip(req: Request): Promise<boolean> {
  const authReq = req as any;
  if (authReq.user?.role === 'ADMIN') return true;
  if (!authReq.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: authReq.user.id },
    select: { isVip: true, vipStartsAt: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } },
  });
  return hasVipAccess(user);
}

export const getMovies = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '24',
      search,
      genre,
      country,
      year,
      type,
      sortBy,
      status: statusFilter,
      vip,
      dubbed,
      lang,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(64, Math.max(1, parseInt(limit as string, 10) || 24));
    const sortLang = resolveSortLang((lang as string | undefined) || (dubbed === 'true' ? 'thuyet-minh' : undefined));
    const listCacheKey = `movies:list:v2:${[
      pageNum,
      limitNum,
      String(search || '').trim().toLowerCase(),
      genre || '',
      country || '',
      year || '',
      type || '',
      sortBy || '',
      statusFilter || '',
      vip || '',
      dubbed || '',
      sortLang || '',
    ].join('|')}`;
    const cachedList = await cacheGet<Record<string, unknown>>(listCacheKey);
    if (cachedList) return res.json(cachedList);

    let raw: any;
    let localSmartMatches: any[] = [];

    if (search) {
      const query = String(search).trim();
      const searchOptions = {
        category: genre as string | undefined,
        country: country as string | undefined,
        year: year as string | undefined,
        sort_field: sortBy === 'views' ? 'view' : sortBy === 'ratingAvg' ? 'tmdb.vote_average' : 'modified.time',
        sort_type: 'desc' as const,
        sort_lang: sortLang,
      };

      // Run upstream + lightweight local scoring in parallel (avoid serial 300-row hydrate).
      const [localResult, upstreamResult] = await Promise.all([
        prisma.movie.findMany({
          take: 120,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            englishTitle: true,
            slug: true,
            releaseYear: true,
            isSeries: true,
            status: true,
            isVip: true,
            isDubbed: true,
            country: { select: { slug: true } },
            movieGenres: { select: { genre: { select: { slug: true } } } },
          },
        }).catch(() => []),
        searchMovies(query, pageNum, limitNum, searchOptions)
          .then((value) => ({ ok: true as const, value }))
          .catch((error) => ({ ok: false as const, error })),
      ]);

      if (!upstreamResult.ok) {
        if (upstreamResult.error instanceof KkphimError) {
          warnCatalogFallback();
          return res.json(await getStoredMoviePage(req.query));
        }
        raw = null;
      } else {
        raw = upstreamResult.value;
      }

      const scoredIds = localResult.flatMap((movie) => {
        if (genre && !movie.movieGenres.some((item) => item.genre.slug === genre)) return [];
        if (country && movie.country.slug !== country) return [];
        if (year && String(movie.releaseYear) !== String(year)) return [];
        if (type === 'series' && !movie.isSeries) return [];
        if (type === 'movie' && movie.isSeries) return [];
        if ((type === 'hoathinh' || type === 'anime') && !movie.movieGenres.some((item) => item.genre.slug === 'hoat-hinh')) return [];
        if (statusFilter && movie.status.toLowerCase() !== String(statusFilter).toLowerCase()) return [];
        if (vip === 'true' && !movie.isVip) return [];
        if (vip === 'false' && movie.isVip) return [];
        if ((dubbed === 'true' || sortLang === 'thuyet-minh' || sortLang === 'long-tieng') && !movie.isDubbed) return [];
        const score = smartSearchScore(query, [movie.title, movie.englishTitle, movie.slug]);
        return score > 0 ? [{ id: movie.id, score }] : [];
      }).sort((first, second) => second.score - first.score).slice(0, limitNum);

      if (scoredIds.length) {
        const hydrated = await prisma.movie.findMany({
          where: { id: { in: scoredIds.map((item) => item.id) } },
          include: storedListInclude,
        }).catch(() => []);
        const byId = new Map(hydrated.map((movie) => [movie.id, mapStoredMovie(movie)]));
        localSmartMatches = scoredIds.map((item) => byId.get(item.id)).filter((movie): movie is NonNullable<typeof movie> => Boolean(movie));
      }
    } else if (genre || country || year || type || sortLang) {
      raw = await fetchMovieList(resolveTypeList(type as string | undefined), {
        page: pageNum,
        limit: limitNum,
        category: genre as string | undefined,
        country: country as string | undefined,
        year: year as string | undefined,
        sort_field: sortBy === 'views'
          ? 'view'
          : sortBy === 'ratingAvg'
            ? 'tmdb.vote_average'
            : 'modified.time',
        sort_type: 'desc',
        sort_lang: sortLang,
      });
    } else {
      raw = await fetchNewMovies(pageNum);
    }

    const extracted = raw ? extractListPagination(raw) : { items: [], total: 0, page: pageNum, limit: limitNum, totalPages: 1, cdn: '' };
    const { items, total, page: currentPage, limit: pageLimit, totalPages, cdn } = extracted;

    let movies = items.map((item) => mapListItem(item, cdn));
    if (localSmartMatches.length) {
      const upstreamSlugs = new Set(movies.map((movie) => movie.slug));
      movies = [...localSmartMatches.filter((movie) => !upstreamSlugs.has(movie.slug)), ...movies].slice(0, limitNum);
    }
    try {
      const localMovies = await prisma.movie.findMany({
        where: { slug: { in: movies.map((movie) => movie.slug) } },
        select: { slug: true, status: true, isVip: true, isDubbed: true },
      });
      const localBySlug = new Map(localMovies.map((movie) => [movie.slug, movie]));
      movies = movies.map((movie) => ({ ...movie, ...localBySlug.get(movie.slug) }));
    } catch {
      // Upstream catalog remains available when the local enrichment database is cold.
    }
    if (statusFilter) movies = movies.filter((movie) => String(movie.status || '').toLowerCase() === String(statusFilter).toLowerCase());
    if (vip === 'true') movies = movies.filter((movie) => movie.isVip);
    if (vip === 'false') movies = movies.filter((movie) => !movie.isVip);
    if (dubbed === 'true') movies = movies.filter((movie) => movie.isDubbed);

    const payload = {
      total: Math.max(total, movies.length),
      page: currentPage,
      limit: pageLimit || limitNum,
      totalPages,
      movies,
    };
    void cacheSet(listCacheKey, payload, search ? 45_000 : 30_000);
    return res.json(payload);
  } catch (error: any) {
    if (error instanceof KkphimError) {
      try {
        warnCatalogFallback();
        return res.json(await getStoredMoviePage(req.query));
      } catch (fallbackError) {
        console.error('Database movie fallback failed.', fallbackError);
      }
    }
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving movies.', error, status);
  }
};

export const getPersonalizedRecommendations = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  try {
    if (!userId) return getProposed(req, res);
    const history = await prisma.watchHistory.findMany({
      where: { userId }, orderBy: { updatedAt: 'desc' }, take: 20,
      include: { movie: { include: { movieGenres: { select: { genreId: true } } } } },
    });
    const watchedIds = history.map((item) => item.movieId);
    const genreScores = new Map<string, number>();
    history.forEach((item, index) => item.movie.movieGenres.forEach(({ genreId }) => genreScores.set(genreId, (genreScores.get(genreId) || 0) + Math.max(1, 20 - index))));
    const genreIds = [...genreScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const candidates = await prisma.movie.findMany({
      where: { id: { notIn: watchedIds }, ...(genreIds.length ? { movieGenres: { some: { genreId: { in: genreIds } } } } : {}) },
      orderBy: [{ updatedAt: 'desc' }], take: 80,
      include: { movieGenres: { include: { genre: true } }, country: true },
    });
    const personalized = history.length > 0 && genreIds.length > 0;
    const movies = personalized
      ? candidates
          .map((movie) => ({
            movie,
            score: movie.movieGenres.reduce((total, item) => total + (genreScores.get(item.genreId) || 0), 0)
              + Number(movie.ratingAvg || 0) * 2
              + Math.log10(Math.max(1, Number(movie.views || 0))),
          }))
          .sort((first, second) => second.score - first.score || second.movie.updatedAt.getTime() - first.movie.updatedAt.getTime())
          .slice(0, 18)
          .map(({ movie }) => movie)
      : candidates.slice(0, 18);
    return res.json({ movies, personalized });
  } catch (error) {
    return internalError(res, 'Không thể tải gợi ý cá nhân hóa.', error);
  }
};

export const getReleaseSchedule = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const episodes = await prisma.episode.findMany({
      where: { airDate: { gte: since, lte: until } }, orderBy: { airDate: 'asc' }, take: 150,
      include: { movie: { select: { id: true, slug: true, title: true, posterUrl: true, status: true } } },
    });
    return res.json(episodes.map((episode) => ({ ...episode, isReleased: Boolean(episode.airDate && episode.airDate <= now) })));
  } catch (error) {
    return internalError(res, 'Không thể tải lịch phát hành.', error);
  }
};

export const getMovieBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const detailCacheKey = `movies:detail:v2:${slug}`;

  try {
    const cached = await cacheGet<Record<string, unknown>>(detailCacheKey);
    if (cached) return res.json(cached);

    // Upsert into DB so favorites/comments get a stable UUID
    const movie = await ensureMovieInDb(slug);
    const payload = shapeMovieForViewer(movie, await viewerCanAccessVip(req));
    void cacheSet(detailCacheKey, payload, 60_000);
    return res.json(payload);
  } catch (error: any) {
    // Older bookmarks used `...-1`; KKPhim now exposes seasons as `...-phan-1`.
    const legacySeasonAlias = slug.match(/-phan-\d+$/) ? slug : slug.replace(/-(\d+)$/, '-phan-$1');
    if (legacySeasonAlias !== slug) {
      try {
        const aliasedMovie = await ensureMovieInDb(legacySeasonAlias);
        const payload = shapeMovieForViewer(aliasedMovie, await viewerCanAccessVip(req));
        void cacheSet(detailCacheKey, payload, 60_000);
        return res.json(payload);
      } catch {
        // Continue to the normal upstream fallback and preserve the original 404.
      }
    }
    // ensureMovieInDb already requested this slug. Retrying the identical
    // upstream call here doubles traffic during a KKPhim outage.
    if (error instanceof KkphimError) {
      return internalError(res, 'Error retrieving movie details.', error, error.status);
    }
    // Fallback: return KKPhim detail without DB if upsert fails
    try {
      const raw = await fetchMovieDetail(slug);
      if (!raw?.status || !raw?.movie) {
        return res.status(404).json({ message: 'Movie not found.' });
      }
      const movie = mapMovieDetail(raw);

      let dbMovie = null;
      try {
        dbMovie = await prisma.movie.findUnique({
          where: { slug },
          select: { isVip: true, vipEarlyAccessUntil: true },
        });
      } catch (dbErr) {
        console.warn('Fallback: Failed to query dbMovie VIP status.', dbErr);
        return res.status(503).json({ message: 'Movie service is temporarily unavailable.' });
      }

      const payload = shapeMovieForViewer({
        ...movie,
        isVip: dbMovie?.isVip || false,
        vipEarlyAccessUntil: dbMovie?.vipEarlyAccessUntil || null,
      }, await viewerCanAccessVip(req));
      void cacheSet(detailCacheKey, payload, 60_000);
      return res.json(payload);
    } catch (inner: any) {
      const status = inner instanceof KkphimError ? inner.status : 500;
      return internalError(res, 'Error retrieving movie details.', inner, status);
    }
  }
};

export const incrementViews = async (req: Request, res: Response) => {
  const { id } = req.params;
  let existing: { id: string; views: number } | null = null;

  try {
    existing = await prisma.movie.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      select: { id: true, views: true },
    });

    if (!existing) {
      return res.json({ id, views: 0, skipped: true });
    }

    const movie = await prisma.movie.update({
      where: { id: existing.id },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    });

    return res.json({ id: movie.id, views: movie.views });
  } catch (error: any) {
    if (isStorageFullError(error) && existing) {
      return res.json({ id: existing.id, views: existing.views, skipped: true });
    }
    return internalError(res, 'Error incrementing view count.', error);
  }
};

export const getTrending = async (req: Request, res: Response) => {
  const limit = Math.min(64, Math.max(1, parseInt((req.query.limit as string) || '12', 10) || 12));
  try {
    const raw = await fetchMovieList('phim-le', {
      page: 1,
      limit,
      sort_field: 'view',
      sort_type: 'desc',
    });
    const { items, cdn } = extractListPagination(raw);
    const movies = items.slice(0, limit).map((item, index) => ({
      ...mapListItem(item, cdn),
      isTrending: true,
      isFeatured: index < 3,
    }));
    return res.json(movies);
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving trending movies.', error, status);
  }
};

export const getProposed = async (req: Request, res: Response) => {
  const limit = Math.min(64, Math.max(1, parseInt((req.query.limit as string) || '12', 10) || 12));
  try {
    const raw = await fetchMovieList('phim-bo', { page: 1, limit });
    const { items, cdn } = extractListPagination(raw);
    const movies = items.slice(0, limit).map((item) => ({
      ...mapListItem(item, cdn),
      isProposed: true,
    }));
    return res.json(movies);
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving proposed movies.', error, status);
  }
};

export const getBanners = async (req: Request, res: Response) => {
  try {
    const raw = await fetchNewMovies(1);
    const { items, cdn } = extractListPagination(raw);
    const banners = items.slice(0, 8).map((item, index) => {
      const movie = mapListItem(item, cdn);
      return {
        id: `kk-banner-${movie.slug}`,
        title: movie.title,
        description: movie.description || movie.englishTitle || movie.title,
        imageUrl: movie.backdropUrl || movie.posterUrl,
        order: index,
        isActive: true,
        movie,
      };
    });
    return res.json(banners);
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving banners.', error, status);
  }
};

/** Home payload in one round trip; shared KKPhim calls are also cached by the client. */
export const getHome = async (_req: Request, res: Response) => {
  try {
    const [homeResult, newResult, proposedResult, trendingResult, chinaResult, koreaResult, vietnamResult] = await Promise.allSettled([
      fetchKkphimHome(),
      fetchNewMovies(1),
      fetchMovieList('phim-bo', { page: 1, limit: 24 }),
      fetchMovieList('phim-le', { page: 1, limit: 12, sort_field: 'view', sort_type: 'desc' }),
      fetchMovieList('phim-bo', { page: 1, limit: 12, country: 'trung-quoc' }),
      fetchMovieList('phim-bo', { page: 1, limit: 12, country: 'han-quoc' }),
      fetchMovieList('phim-bo', { page: 1, limit: 12, country: 'viet-nam' }),
    ]);

    const results = [homeResult, newResult, proposedResult, trendingResult, chinaResult, koreaResult, vietnamResult];
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length === results.length) throw (newResult as PromiseRejectedResult).reason || (homeResult as PromiseRejectedResult).reason;
    if (failures.length) console.warn(`Home payload is partial: ${failures.length}/${results.length} upstream requests failed.`);

    const emptyList = { items: [], total: 0, page: 1, limit: 0, totalPages: 1, cdn: '' };
    const homeToday = homeResult.status === 'fulfilled' ? extractListPagination(homeResult.value) : emptyList;
    const latest = newResult.status === 'fulfilled' ? extractListPagination(newResult.value) : emptyList;
    // Prefer KKPhim /v1/api/home (updated today) for banners/newest; fall back to phim-moi-cap-nhat-v3.
    const primaryLatest = homeToday.items.length ? homeToday : latest;
    let proposed = proposedResult.status === 'fulfilled' ? extractListPagination(proposedResult.value) : emptyList;
    const trending = trendingResult.status === 'fulfilled' ? extractListPagination(trendingResult.value) : emptyList;
    const china = chinaResult.status === 'fulfilled' ? extractListPagination(chinaResult.value) : emptyList;
    const korea = koreaResult.status === 'fulfilled' ? extractListPagination(koreaResult.value) : emptyList;
    const vietnam = vietnamResult.status === 'fulfilled' ? extractListPagination(vietnamResult.value) : emptyList;
    const newestMovies = primaryLatest.items.map((item) => mapListItem(item, primaryLatest.cdn));
    const trendingMovies = trending.items.map((item) => mapListItem(item, trending.cdn));

    // Keep the recommendation row meaningfully different from newest + trending,
    // but pull extra pages until the row is long enough to scroll on desktop.
    const PROPOSED_TARGET = 18;
    const occupiedSlugs = new Set([
      ...primaryLatest.items.slice(0, 24),
      ...trending.items.slice(0, 12),
    ].map((item) => item.slug).filter(Boolean));
    const seenProposed = new Set<string>();
    let distinctProposedItems: typeof proposed.items = [];
    let proposedCdn = proposed.cdn;
    let proposedPage = 1;
    let proposedTotalPages = Math.max(1, proposed.totalPages || 1);

    const pushProposed = (items: typeof proposed.items, cdn: string) => {
      if (cdn) proposedCdn = cdn;
      for (const item of items) {
        const slug = item?.slug;
        if (!slug || occupiedSlugs.has(slug) || seenProposed.has(slug)) continue;
        seenProposed.add(slug);
        distinctProposedItems.push(item);
        if (distinctProposedItems.length >= PROPOSED_TARGET) break;
      }
    };

    pushProposed(proposed.items, proposed.cdn);

    while (distinctProposedItems.length < PROPOSED_TARGET && proposedPage < proposedTotalPages && proposedPage < 4) {
      proposedPage += 1;
      try {
        const nextPage = await fetchMovieList('phim-bo', { page: proposedPage, limit: 24 });
        const nextProposed = extractListPagination(nextPage);
        proposedTotalPages = Math.max(proposedTotalPages, nextProposed.totalPages || 1);
        pushProposed(nextProposed.items, nextProposed.cdn);
      } catch {
        break;
      }
    }

    // If filtering left the row too short, top up from the original lists
    // (prefer uniqueness, but scrolling beats empty space).
    if (distinctProposedItems.length < 12) {
      for (const item of [...proposed.items, ...primaryLatest.items, ...trending.items]) {
        const slug = item?.slug;
        if (!slug || seenProposed.has(slug)) continue;
        seenProposed.add(slug);
        distinctProposedItems.push(item);
        if (distinctProposedItems.length >= PROPOSED_TARGET) break;
      }
    }

    const bannerMovies = newestMovies.length > 0
      ? newestMovies
      : (trendingMovies.length > 0 ? trendingMovies : proposed.items.map((item) => mapListItem(item, proposed.cdn)));

    // List responses from KKPhim do not include trailer_url, while the stored
    // detail record does. Enrich home cards so quick view can autoplay the
    // same trailer that is available on the movie detail page.
    const homeSlugs = [...new Set([
      ...primaryLatest.items,
      ...trending.items,
      ...distinctProposedItems,
      ...china.items,
      ...korea.items,
      ...vietnam.items,
    ].map((item) => item.slug).filter(Boolean))];
    let trailerBySlug = new Map<string, string>();
    let descriptionBySlug = new Map<string, string>();
    try {
      const storedExtras = await prisma.movie.findMany({
        where: { slug: { in: homeSlugs } },
        select: { slug: true, trailerUrl: true, description: true },
      });
      trailerBySlug = new Map(storedExtras.flatMap((movie) => movie.trailerUrl ? [[movie.slug, movie.trailerUrl]] : []));
      descriptionBySlug = new Map(storedExtras.flatMap((movie) => {
        const text = (movie.description || '').trim();
        return text ? [[movie.slug, text]] : [];
      }));
    } catch {
      // The upstream home payload remains usable when database enrichment fails.
    }
    const withHomeExtras = <T extends { slug: string; title?: string; englishTitle?: string | null; description?: string; trailerUrl?: string | null }>(movie: T): T => {
      const storedDescription = descriptionBySlug.get(movie.slug) || '';
      const currentDescription = (movie.description || '').trim();
      const titleLike = (value: string) => !value || value === movie.title || value === movie.englishTitle;
      const description = (!titleLike(storedDescription) ? storedDescription : null)
        || (!titleLike(currentDescription) ? currentDescription : null)
        || storedDescription
        || currentDescription
        || '';
      return {
        ...movie,
        trailerUrl: trailerBySlug.get(movie.slug) || movie.trailerUrl || null,
        description,
      };
    };

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    return res.json({
      banners: bannerMovies.slice(0, 8).map((rawMovie, index) => {
        const movie = withHomeExtras(rawMovie);
        return ({
        id: `kk-banner-${movie.slug}`,
        title: movie.title,
        description: movie.description || movie.englishTitle || movie.title,
        imageUrl: movie.backdropUrl || movie.posterUrl,
        order: index,
        isActive: true,
        movie,
      }); }),
      trending: trendingMovies.slice(0, 12).map((movie, index) => ({
        ...withHomeExtras(movie),
        isTrending: true,
        isFeatured: index < 3,
      })),
      proposed: distinctProposedItems.slice(0, PROPOSED_TARGET).map((item) => ({
        ...withHomeExtras(mapListItem(item, proposedCdn || proposed.cdn)),
        isProposed: true,
      })),
      movies: newestMovies.map(withHomeExtras),
      countries: {
        china: china.items.map((item) => withHomeExtras(mapListItem(item, china.cdn))),
        korea: korea.items.map((item) => withHomeExtras(mapListItem(item, korea.cdn))),
        vietnam: vietnam.items.map((item) => withHomeExtras(mapListItem(item, vietnam.cdn))),
      },
      partial: failures.length > 0,
      source: homeToday.items.length ? 'kkphim-home+catalog' : 'kkphim-catalog',
    });
  } catch (error: any) {
    if (error instanceof KkphimError) {
      try {
        const stored = await prisma.movie.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 48,
          include: storedListInclude,
        });
        const movies = stored.map(mapStoredMovie);
        const byViews = [...movies].sort((a, b) => Number(b.views) - Number(a.views));
        const byRating = [...movies].sort((a, b) => Number(b.ratingAvg) - Number(a.ratingAvg));
        const countryMovies = (slug: string) => movies.filter((movie) => movie.country?.slug === slug).slice(0, 12);
        warnCatalogFallback();
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=300');
        return res.json({
          banners: movies.slice(0, 8).map((movie, index) => ({
            id: `db-banner-${movie.slug}`,
            title: movie.title,
            description: movie.description || movie.englishTitle || movie.title,
            imageUrl: movie.backdropUrl || movie.posterUrl,
            order: index,
            isActive: true,
            movie,
          })),
          trending: byViews.slice(0, 12).map((movie, index) => ({
            ...movie,
            isTrending: true,
            isFeatured: index < 3,
          })),
          proposed: byRating.slice(0, 18).map((movie) => ({ ...movie, isProposed: true })),
          movies: movies.slice(0, 24),
          countries: {
            china: countryMovies('trung-quoc'),
            korea: countryMovies('han-quoc'),
            vietnam: countryMovies('viet-nam'),
          },
          partial: true,
          source: 'database',
        });
      } catch (fallbackError) {
        console.error('Database home fallback failed.', fallbackError);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving home movies.', error, status);
  }
};
