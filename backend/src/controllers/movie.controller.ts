import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  fetchNewMovies,
  fetchMovieList,
  searchMovies,
  fetchMovieDetail,
  KkphimError,
} from '../services/kkphim.client';
import { mapListItem, mapMovieDetail, extractListPagination } from '../services/kkphim.mapper';
import { ensureMovieInDb } from '../services/movie.upsert';
import { internalError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { shapeMovieForViewer } from '../lib/vip-content';


function resolveTypeList(type?: string): string {
  if (type === 'series') return 'phim-bo';
  if (type === 'movie') return 'phim-le';
  if (type === 'hoathinh' || type === 'anime') return 'hoat-hinh';
  if (type === 'tvshows' || type === 'tv') return 'tv-shows';
  return 'phim-le';
}

async function viewerCanAccessVip(req: Request): Promise<boolean> {
  const authReq = req as any;
  if (authReq.user?.role === 'ADMIN') return true;
  if (!authReq.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: authReq.user.id },
    select: { isVip: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } },
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
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(64, Math.max(1, parseInt(limit as string, 10) || 24));

    let raw: any;

    if (search) {
      raw = await searchMovies(String(search), pageNum, limitNum, {
        category: genre as string | undefined,
        country: country as string | undefined,
        year: year as string | undefined,
        sort_field: sortBy === 'views'
          ? 'view'
          : sortBy === 'ratingAvg'
            ? 'tmdb.vote_average'
            : 'modified.time',
        sort_type: 'desc',
      });
    } else if (genre || country || year || type) {
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
      });
    } else {
      raw = await fetchNewMovies(pageNum);
    }

    const { items, total, page: currentPage, limit: pageLimit, totalPages, cdn } =
      extractListPagination(raw);

    const movies = items.map((item) => mapListItem(item, cdn));

    return res.json({
      total,
      page: currentPage,
      limit: pageLimit || limitNum,
      totalPages,
      movies,
    });
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving movies.', error, status);
  }
};

export const getMovieBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    // Upsert into DB so favorites/comments get a stable UUID
    const movie = await ensureMovieInDb(slug);

    return res.json(shapeMovieForViewer(movie, await viewerCanAccessVip(req)));
  } catch (error: any) {
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

      return res.json(shapeMovieForViewer({
        ...movie,
        isVip: dbMovie?.isVip || false,
        vipEarlyAccessUntil: dbMovie?.vipEarlyAccessUntil || null,
      }, await viewerCanAccessVip(req)));
    } catch (inner: any) {
      const status = inner instanceof KkphimError ? inner.status : 500;
      return internalError(res, 'Error retrieving movie details.', inner, status);
    }
  }
};

export const incrementViews = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Prefer UUID; also accept slug for hybrid clients
    const existing = await prisma.movie.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return res.json({ id, views: 0, skipped: true });
    }

    const movie = await prisma.movie.update({
      where: { id: existing.id },
      data: { views: { increment: 1 } },
    });

    return res.json({ id: movie.id, views: movie.views });
  } catch (error: any) {
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
    const [newResult, proposedResult, trendingResult] = await Promise.allSettled([
      fetchNewMovies(1),
      fetchMovieList('phim-bo', { page: 1, limit: 12 }),
      fetchMovieList('phim-le', { page: 1, limit: 12, sort_field: 'view', sort_type: 'desc' }),
    ]);

    const failures = [newResult, proposedResult, trendingResult].filter((result) => result.status === 'rejected');
    if (failures.length === 3) throw (newResult as PromiseRejectedResult).reason;
    if (failures.length) console.warn(`Home payload is partial: ${failures.length}/3 upstream requests failed.`);

    const emptyList = { items: [], total: 0, page: 1, limit: 0, totalPages: 1, cdn: '' };
    const latest = newResult.status === 'fulfilled' ? extractListPagination(newResult.value) : emptyList;
    let proposed = proposedResult.status === 'fulfilled' ? extractListPagination(proposedResult.value) : emptyList;
    const trending = trendingResult.status === 'fulfilled' ? extractListPagination(trendingResult.value) : emptyList;
    const newestMovies = latest.items.map((item) => mapListItem(item, latest.cdn));
    const trendingMovies = trending.items.map((item) => mapListItem(item, trending.cdn));

    // Keep the recommendation row meaningfully different from the latest row.
    // KKPhim can return the same titles in both lists, especially when the
    // newest catalog is dominated by series. Fetch the next page only when
    // the first recommendation page has collisions.
    const occupiedSlugs = new Set([
      ...latest.items,
      ...trending.items,
    ].map((item) => item.slug).filter(Boolean));
    let distinctProposedItems = proposed.items.filter((item) => !occupiedSlugs.has(item.slug));

    if (distinctProposedItems.length < Math.min(12, proposed.items.length) && proposed.totalPages > 1) {
      try {
        const nextPage = await fetchMovieList('phim-bo', { page: 2, limit: 12 });
        const nextProposed = extractListPagination(nextPage);
        distinctProposedItems = [
          ...distinctProposedItems,
          ...nextProposed.items.filter((item) => !occupiedSlugs.has(item.slug)),
        ];
      } catch {
        // Keep the first page when the optional follow-up request fails.
      }
    }

    const bannerMovies = newestMovies.length > 0
      ? newestMovies
      : (trendingMovies.length > 0 ? trendingMovies : proposed.items.map((item) => mapListItem(item, proposed.cdn)));

    return res.json({
      banners: bannerMovies.slice(0, 8).map((movie, index) => ({
        id: `kk-banner-${movie.slug}`,
        title: movie.title,
        description: movie.description || movie.englishTitle || movie.title,
        imageUrl: movie.backdropUrl || movie.posterUrl,
        order: index,
        isActive: true,
        movie,
      })),
      trending: trendingMovies.slice(0, 12).map((movie, index) => ({
        ...movie,
        isTrending: true,
        isFeatured: index < 3,
      })),
      proposed: distinctProposedItems.slice(0, 12).map((item) => ({
        ...mapListItem(item, proposed.cdn),
        isProposed: true,
      })),
      movies: newestMovies,
      partial: failures.length > 0,
    });
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving home movies.', error, status);
  }
};
