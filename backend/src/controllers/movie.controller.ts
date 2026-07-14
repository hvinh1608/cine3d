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


function resolveTypeList(type?: string): string {
  if (type === 'series') return 'phim-bo';
  if (type === 'movie') return 'phim-le';
  if (type === 'hoathinh' || type === 'anime') return 'hoat-hinh';
  if (type === 'tvshows' || type === 'tv') return 'tv-shows';
  return 'phim-le';
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
      raw = await searchMovies(String(search), pageNum, limitNum);
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

    // Check VIP Gating
    let isUserVip = false;
    const authReq = req as any;
    const isAdmin = authReq.user?.role === 'ADMIN';

    if (authReq.user?.id) {
      const dbUser = await prisma.user.findUnique({ where: { id: authReq.user.id }, select: { isVip: true, vipExpiresAt: true, isLocked: true } });
      isUserVip = hasVipAccess(dbUser);
    }

    const canAccess = isAdmin || isUserVip;

    if (movie.isVip && !canAccess) {
      const gatedMovie = {
        ...movie,
        requiresVip: true,
        episodes: movie.episodes.map((ep: any) => ({
          ...ep,
          videoSources: [], // Strip video sources for non-VIP
        })),
      };
      return res.json(gatedMovie);
    }

    return res.json(movie);
  } catch (error: any) {
    // Fallback: return KKPhim detail without DB if upsert fails
    try {
      const raw = await fetchMovieDetail(slug);
      if (!raw?.status || !raw?.movie) {
        return res.status(404).json({ message: 'Movie not found.' });
      }
      const movie = mapMovieDetail(raw);

      // Check database VIP flag if movie exists in DB
      let dbMovie = null;
      try {
        dbMovie = await prisma.movie.findUnique({ where: { slug } });
      } catch (dbErr) {
        console.warn('Fallback: Failed to query dbMovie VIP status.', dbErr);
        return res.status(503).json({ message: 'Movie service is temporarily unavailable.' });
      }

      if (dbMovie?.isVip) {
        let isUserVip = false;
        const authReq = req as any;
        const isAdmin = authReq.user?.role === 'ADMIN';
        if (authReq.user?.id) {
          try {
            const dbUser = await prisma.user.findUnique({ where: { id: authReq.user.id }, select: { isVip: true, vipExpiresAt: true, isLocked: true } });
            isUserVip = hasVipAccess(dbUser);
          } catch (dbErr) {
            console.warn('Fallback: Failed to query dbUser VIP status.', dbErr);
          }
        }
        const canAccess = isAdmin || isUserVip;

        if (!canAccess) {
          const gatedMovie = {
            ...movie,
            isVip: true,
            requiresVip: true,
            episodes: movie.episodes.map((ep: any) => ({
              ...ep,
              videoSources: [],
            })),
          };
          return res.json(gatedMovie);
        }
      }

      return res.json(movie);
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
    const [newRaw, proposedRaw, trendingRaw] = await Promise.all([
      fetchNewMovies(1),
      fetchMovieList('phim-bo', { page: 1, limit: 12 }),
      fetchMovieList('phim-le', { page: 1, limit: 12, sort_field: 'view', sort_type: 'desc' }),
    ]);
    const latest = extractListPagination(newRaw);
    const proposed = extractListPagination(proposedRaw);
    const trending = extractListPagination(trendingRaw);
    const newestMovies = latest.items.map((item) => mapListItem(item, latest.cdn));
    const trendingMovies = trending.items.map((item) => mapListItem(item, trending.cdn));

    return res.json({
      banners: newestMovies.slice(0, 8).map((movie, index) => ({
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
      proposed: proposed.items.slice(0, 12).map((item) => ({
        ...mapListItem(item, proposed.cdn),
        isProposed: true,
      })),
      movies: newestMovies,
    });
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving home movies.', error, status);
  }
};
