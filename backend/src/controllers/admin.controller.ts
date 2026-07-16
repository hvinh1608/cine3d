import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendPushToUsers } from '../services/push.service';
import { checkDueVideoSources, checkVideoSource } from '../services/source-health.service';

async function resolveCountryId(value: unknown): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const country = await prisma.country.findFirst({
    where: { OR: [{ id: input }, { slug: input }, { name: input }] },
    select: { id: true },
  });
  return country?.id || null;
}

async function validateGenreIds(value: unknown): Promise<string[] | null> {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return [];
  const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && !!id))];
  if (!ids.length) return [];
  const count = await prisma.genre.count({ where: { id: { in: ids } } });
  return count === ids.length ? ids : null;
}

function movieWriteError(res: Response, error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Slug phim đã được sử dụng bởi phim khác.' });
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return res.status(400).json({ message: 'Quốc gia hoặc thể loại đã chọn không còn hợp lệ. Vui lòng tải lại trang và chọn lại.' });
    }
  }
  return internalError(res, fallback, error);
}


// Get Dashboard Stats
export const getStats = async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalMovies, totalEpisodes, totalReports] = await prisma.$transaction([
      prisma.user.count(),
      prisma.movie.count(),
      prisma.episode.count(),
      prisma.report.count({ where: { status: 'Pending' } }),
    ]);

    // Sum of views
    const viewsAggregate = await prisma.movie.aggregate({
      _sum: { views: true },
    });
    const totalViews = viewsAggregate._sum.views || 0;

    // Top 5 most viewed movies
    const topMovies = await prisma.movie.findMany({
      orderBy: { views: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        views: true,
        ratingAvg: true,
      },
    });

    // Recent reports
    const recentReports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: { select: { username: true } },
        movie: { select: { title: true } },
      },
    });

    return res.json({
      totalUsers,
      totalMovies,
      totalEpisodes,
      totalViews,
      pendingReports: totalReports,
      topMovies,
      recentReports,
    });
  } catch (error: any) {
    return internalError(res, 'Error retrieving stats.', error);
  }
};

// CRUD: Manage Movies
export const getLocalMovies = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where: Prisma.MovieWhereInput = search
      ? { OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { englishTitle: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ] }
      : {};

    const [movies, total] = await prisma.$transaction([
      prisma.movie.findMany({
        where,
        include: {
          country: true,
          movieGenres: { include: { genre: true } },
          episodes: { include: { videoSources: true, subtitles: true }, orderBy: { episodeOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.movie.count({ where }),
    ]);
    return res.json({ movies, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error: any) {
    return internalError(res, 'Error retrieving local movies.', error);
  }
};

export const getAdminCountries = async (_req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
    return res.json(countries);
  } catch (error: any) {
    return internalError(res, 'Error retrieving admin countries.', error);
  }
};

export const getAdminGenres = async (_req: Request, res: Response) => {
  try {
    const genres = await prisma.genre.findMany({ orderBy: { name: 'asc' } });
    return res.json(genres);
  } catch (error: any) {
    return internalError(res, 'Error retrieving admin genres.', error);
  }
};

export const createMovie = async (req: Request, res: Response) => {
  const {
    title,
    englishTitle,
    slug,
    description,
    backdropUrl,
    posterUrl,
    trailerUrl,
    releaseYear,
    duration,
    quality,
    isSeries,
    isDubbed,
    status,
    countryId,
    genreIds, // string[]
    actorIds, // string[]
    directorIds, // string[]
    isFeatured,
    isTrending,
    isProposed,
    isVip,
    vipEarlyAccessUntil,
  } = req.body;

  if (!title || !slug || !description || !backdropUrl || !posterUrl || !countryId) {
    return res.status(400).json({ message: 'Missing required movie fields.' });
  }
  if (vipEarlyAccessUntil && Number.isNaN(new Date(vipEarlyAccessUntil).getTime())) {
    return res.status(400).json({ message: 'Invalid VIP early-access date.' });
  }

  try {
    const resolvedCountryId = await resolveCountryId(countryId);
    if (!resolvedCountryId) {
      return res.status(400).json({ message: 'Quốc gia không hợp lệ. Vui lòng chọn lại.' });
    }
    const validGenreIds = await validateGenreIds(genreIds || []);
    if (validGenreIds === null) {
      return res.status(400).json({ message: 'Danh sách thể loại không hợp lệ.' });
    }

    const existing = await prisma.movie.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ message: 'Movie slug must be unique.' });
    }

    const movie = await prisma.movie.create({
      data: {
        title,
        englishTitle,
        slug,
        description,
        backdropUrl,
        posterUrl,
        trailerUrl,
        releaseYear: parseInt(releaseYear, 10) || new Date().getFullYear(),
        duration: parseInt(duration, 10) || 120,
        quality: quality || 'HD',
        isSeries: !!isSeries,
        isDubbed: !!isDubbed,
        status: status || 'Completed',
        isFeatured: isFeatured !== undefined ? !!isFeatured : false,
        isTrending: isTrending !== undefined ? !!isTrending : false,
        isProposed: isProposed !== undefined ? !!isProposed : false,
        isVip: isVip !== undefined ? !!isVip : false,
        vipEarlyAccessUntil: vipEarlyAccessUntil ? new Date(vipEarlyAccessUntil) : null,
        countryId: resolvedCountryId,
        movieGenres: {
          create: validGenreIds.map((id: string) => ({ genreId: id })),
        },
        movieActors: {
          create: (actorIds || []).map((id: string) => ({ actorId: id })),
        },
        movieDirectors: {
          create: (directorIds || []).map((id: string) => ({ directorId: id })),
        },
      },
    });

    return res.status(201).json({ message: 'Movie created successfully.', movie });
  } catch (error: any) {
    return movieWriteError(res, error, 'Error creating movie.');
  }
};

export const updateMovie = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    englishTitle,
    slug,
    description,
    backdropUrl,
    posterUrl,
    trailerUrl,
    releaseYear,
    duration,
    quality,
    isSeries,
    isDubbed,
    status,
    countryId,
    genreIds,
    actorIds,
    directorIds,
    isFeatured,
    isTrending,
    isProposed,
    isVip,
    vipEarlyAccessUntil,
  } = req.body;

  if (vipEarlyAccessUntil && Number.isNaN(new Date(vipEarlyAccessUntil).getTime())) {
    return res.status(400).json({ message: 'Invalid VIP early-access date.' });
  }

  try {
    const existingMovie = await prisma.movie.findUnique({ where: { id } });
    if (!existingMovie) return res.status(404).json({ message: 'Movie not found.' });

    const resolvedCountryId = countryId !== undefined ? await resolveCountryId(countryId) : undefined;
    if (countryId !== undefined && !resolvedCountryId) {
      return res.status(400).json({ message: 'Quốc gia không hợp lệ. Vui lòng chọn lại.' });
    }
    const validGenreIds = await validateGenreIds(genreIds);
    if (genreIds !== undefined && validGenreIds === null) {
      return res.status(400).json({ message: 'Danh sách thể loại không hợp lệ.' });
    }

    // Update movie and relationships (delete old links and create new ones)
    const movie = await prisma.movie.update({
      where: { id },
      data: {
        title,
        englishTitle,
        slug,
        description,
        backdropUrl,
        posterUrl,
        trailerUrl,
        releaseYear: releaseYear !== undefined ? parseInt(releaseYear, 10) : undefined,
        duration: duration !== undefined ? parseInt(duration, 10) : undefined,
        quality,
        isSeries,
        isDubbed: isDubbed !== undefined ? !!isDubbed : undefined,
        status,
        isFeatured: isFeatured !== undefined ? !!isFeatured : undefined,
        isTrending: isTrending !== undefined ? !!isTrending : undefined,
        isProposed: isProposed !== undefined ? !!isProposed : undefined,
        isVip: isVip !== undefined ? !!isVip : undefined,
        vipEarlyAccessUntil: vipEarlyAccessUntil !== undefined
          ? (vipEarlyAccessUntil ? new Date(vipEarlyAccessUntil) : null)
          : undefined,
        countryId: resolvedCountryId || undefined,
        movieGenres: validGenreIds
          ? {
              deleteMany: {},
              create: validGenreIds.map((gId: string) => ({ genreId: gId })),
            }
          : undefined,
        movieActors: actorIds
          ? {
              deleteMany: {},
              create: actorIds.map((aId: string) => ({ actorId: aId })),
            }
          : undefined,
        movieDirectors: directorIds
          ? {
              deleteMany: {},
              create: directorIds.map((dId: string) => ({ directorId: dId })),
            }
          : undefined,
      },
    });

    return res.json({ message: 'Movie updated successfully.', movie });
  } catch (error: any) {
    return movieWriteError(res, error, 'Error updating movie.');
  }
};

export const deleteMovie = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const movie = await prisma.movie.findUnique({ where: { id } });
    if (!movie) return res.status(404).json({ message: 'Movie not found.' });

    await prisma.movie.delete({ where: { id } });
    return res.json({ message: 'Movie deleted successfully.' });
  } catch (error: any) {
    return internalError(res, 'Error deleting movie.', error);
  }
};

// CRUD: Manage Episodes
export const createEpisode = async (req: Request, res: Response) => {
  const { movieId, title, episodeOrder, seasonNumber, airDate, videoSources, subtitles, introEndSeconds, outroStartSeconds } = req.body;

  if (!movieId || !title || episodeOrder === undefined) {
    return res.status(400).json({ message: 'movieId, title, and episodeOrder are required.' });
  }

  try {
    const episode = await prisma.episode.create({
      data: {
        movieId,
        title,
        episodeOrder: parseInt(episodeOrder, 10),
        seasonNumber: Math.max(1, parseInt(seasonNumber, 10) || 1),
        airDate: airDate ? new Date(airDate) : null,
        introEndSeconds: introEndSeconds === undefined || introEndSeconds === '' ? null : Math.max(0, parseInt(introEndSeconds, 10)),
        outroStartSeconds: outroStartSeconds === undefined || outroStartSeconds === '' ? null : Math.max(0, parseInt(outroStartSeconds, 10)),
        videoSources: {
          create: (videoSources || []).map((src: any) => ({
            server: src.server,
            quality: src.quality,
            url: src.url,
            type: src.type || 'hls',
            isPremium: !!src.isPremium,
          })),
        },
        subtitles: {
          create: (subtitles || []).map((sub: any) => ({
            language: sub.language,
            url: sub.url,
          })),
        },
      },
    });

    // Update movie episode count
    const count = await prisma.episode.count({ where: { movieId } });
    await prisma.movie.update({
      where: { id: movieId },
      data: { episodeCount: count },
    });

    const [movie, followers] = await Promise.all([
      prisma.movie.findUnique({ where: { id: movieId }, select: { title: true, slug: true } }),
      prisma.movieFollow.findMany({ where: { movieId }, select: { userId: true } }),
    ]);
    const releaseTime = airDate ? new Date(airDate).getTime() : null;
    if (movie && followers.length > 0 && (!releaseTime || releaseTime <= Date.now())) {
      const userIds = followers.map((entry) => entry.userId);
      const notification = {
        title: `${movie.title} có tập mới`,
        message: `${title} vừa được cập nhật. Xem ngay trên CINE3D.`,
        url: `/watch/${movie.slug}?ep=${Math.max(1, parseInt(episodeOrder, 10))}`,
      };
      await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...notification })) });
      void sendPushToUsers(userIds, { title: notification.title, body: notification.message, url: notification.url });
      await prisma.episode.update({ where: { id: episode.id }, data: { releaseNotifiedAt: new Date() } });
    }

    return res.status(201).json({ message: 'Episode created successfully.', episode });
  } catch (error: any) {
    return internalError(res, 'Error creating episode.', error);
  }
};

export const createEpisodesBulk = async (req: Request, res: Response) => {
  const movieId = typeof req.body.movieId === 'string' ? req.body.movieId : '';
  const rows = Array.isArray(req.body.episodes) ? req.body.episodes : [];
  if (!movieId || rows.length < 1 || rows.length > 100) {
    return res.status(400).json({ message: 'Chọn phim và nhập từ 1 đến 100 tập.' });
  }

  const normalized: Array<{ row: number; title: string; episodeOrder: number; seasonNumber: number; airDate: Date | null; server: string; quality: string; url: string; type: 'hls' | 'mp4'; isPremium: boolean }> = rows.map((row: any, index: number) => ({
    row: index + 1,
    title: typeof row.title === 'string' ? row.title.trim() : '',
    episodeOrder: Number(row.episodeOrder),
    seasonNumber: Math.max(1, Number(row.seasonNumber) || 1),
    airDate: row.airDate ? new Date(row.airDate) : null,
    server: typeof row.server === 'string' && row.server.trim() ? row.server.trim() : 'Main Server',
    quality: typeof row.quality === 'string' && row.quality.trim() ? row.quality.trim() : '1080p',
    url: typeof row.url === 'string' ? row.url.trim() : '',
    type: row.type === 'mp4' ? 'mp4' : 'hls',
    isPremium: Boolean(row.isPremium),
  }));
  const invalid = normalized.find((row) => !row.title || !Number.isInteger(row.episodeOrder) || row.episodeOrder < 1 || !row.url || (row.airDate && Number.isNaN(row.airDate.getTime())));
  if (invalid) return res.status(400).json({ message: `Dòng ${invalid.row} không hợp lệ. Kiểm tra số tập, tên, URL và ngày phát.` });
  const orders = normalized.map((row) => row.episodeOrder);
  if (new Set(orders).size !== orders.length) return res.status(400).json({ message: 'Danh sách có số tập bị trùng.' });

  try {
    const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } });
    if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim.' });
    const existing = await prisma.episode.findMany({ where: { movieId, episodeOrder: { in: orders } }, select: { episodeOrder: true } });
    if (existing.length) return res.status(409).json({ message: `Các tập đã tồn tại: ${existing.map((item) => item.episodeOrder).join(', ')}.` });

    const created = await prisma.$transaction(async (tx) => {
      const episodes = [];
      for (const row of normalized) {
        episodes.push(await tx.episode.create({
          data: {
            movieId,
            title: row.title,
            episodeOrder: row.episodeOrder,
            seasonNumber: row.seasonNumber,
            airDate: row.airDate,
            videoSources: { create: [{ server: row.server, quality: row.quality, url: row.url, type: row.type, isPremium: row.isPremium }] },
          },
        }));
      }
      const episodeCount = await tx.episode.count({ where: { movieId } });
      await tx.movie.update({ where: { id: movieId }, data: { episodeCount } });
      return episodes;
    });
    return res.status(201).json({ message: `Đã nhập ${created.length} tập.`, count: created.length });
  } catch (error) {
    return internalError(res, 'Không thể nhập tập hàng loạt.', error);
  }
};

export const updateEpisode = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, episodeOrder, seasonNumber, airDate, videoSources, subtitles, introEndSeconds, outroStartSeconds } = req.body;

  try {
    const existing = await prisma.episode.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Episode not found.' });

    const episode = await prisma.episode.update({
      where: { id },
      data: {
        title,
        episodeOrder: episodeOrder !== undefined ? parseInt(episodeOrder, 10) : undefined,
        seasonNumber: seasonNumber !== undefined ? Math.max(1, parseInt(seasonNumber, 10) || 1) : undefined,
        airDate: airDate !== undefined ? (airDate ? new Date(airDate) : null) : undefined,
        releaseNotifiedAt: airDate !== undefined ? null : undefined,
        introEndSeconds: introEndSeconds === undefined ? undefined : (introEndSeconds === '' || introEndSeconds === null ? null : Math.max(0, parseInt(introEndSeconds, 10))),
        outroStartSeconds: outroStartSeconds === undefined ? undefined : (outroStartSeconds === '' || outroStartSeconds === null ? null : Math.max(0, parseInt(outroStartSeconds, 10))),
        videoSources: videoSources
          ? {
              deleteMany: {},
              create: videoSources.map((src: any) => ({
                server: src.server,
                quality: src.quality,
                url: src.url,
                type: src.type || 'hls',
                isPremium: !!src.isPremium,
              })),
            }
          : undefined,
        subtitles: subtitles
          ? {
              deleteMany: {},
              create: subtitles.map((sub: any) => ({
                language: sub.language,
                url: sub.url,
              })),
            }
          : undefined,
      },
    });

    return res.json({ message: 'Episode updated successfully.', episode });
  } catch (error: any) {
    return internalError(res, 'Error updating episode.', error);
  }
};

export const deleteEpisode = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const episode = await prisma.episode.findUnique({ where: { id } });
    if (!episode) return res.status(404).json({ message: 'Episode not found.' });

    const movieId = episode.movieId;
    await prisma.episode.delete({ where: { id } });

    // Update movie episode count
    const count = await prisma.episode.count({ where: { movieId } });
    await prisma.movie.update({
      where: { id: movieId },
      data: { episodeCount: count },
    });

    return res.json({ message: 'Episode deleted successfully.' });
  } catch (error: any) {
    return internalError(res, 'Error deleting episode.', error);
  }
};

export const getVideoSourceHealth = async (_req: Request, res: Response) => {
  try {
    const [sources, totals] = await Promise.all([
      prisma.videoSource.findMany({
        orderBy: [{ healthStatus: 'asc' }, { consecutiveFailures: 'desc' }, { lastCheckedAt: 'asc' }],
        take: 200,
        include: { episode: { select: { title: true, episodeOrder: true, movie: { select: { title: true, slug: true } } } } },
      }),
      prisma.videoSource.groupBy({ by: ['healthStatus'], _count: { _all: true } }),
    ]);
    return res.json({ sources, totals: Object.fromEntries(totals.map((item) => [item.healthStatus, item._count._all])) });
  } catch (error) {
    return internalError(res, 'Không thể tải trạng thái nguồn phát.', error);
  }
};

export const checkVideoSources = async (req: Request, res: Response) => {
  try {
    if (req.params.id) {
      const source = await prisma.videoSource.findUnique({ where: { id: req.params.id }, select: { id: true, url: true, consecutiveFailures: true } });
      if (!source) return res.status(404).json({ message: 'Không tìm thấy nguồn phát.' });
      return res.json(await checkVideoSource(source));
    }
    const results = await checkDueVideoSources(50);
    return res.json({ checked: results.length, failed: results.filter((result) => result.status === 'rejected').length });
  } catch (error) {
    return internalError(res, 'Không thể kiểm tra nguồn phát.', error);
  }
};

// Manage Users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        isVerified: true,
        isLocked: true,
        isVip: true,
        vipExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json(users);
  } catch (error: any) {
    return internalError(res, 'Error retrieving users.', error);
  }
};

export const toggleUserLock = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (req.user?.id === id) return res.status(400).json({ message: 'You cannot lock your own account.' });

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isLocked: !user.isLocked },
    });

    // If locking, delete their active refresh tokens
    if (updatedUser.isLocked) {
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    return res.json({
      message: updatedUser.isLocked ? 'User locked successfully.' : 'User unlocked successfully.',
      isLocked: updatedUser.isLocked,
    });
  } catch (error: any) {
    return internalError(res, 'Error toggling user lock status.', error);
  }
};

export const toggleUserVip = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isVip: !user.isVip },
    });

    return res.json({
      message: updatedUser.isVip ? 'User upgraded to VIP successfully.' : 'User downgraded from VIP successfully.',
      isVip: updatedUser.isVip,
    });
  } catch (error: any) {
    return internalError(res, 'Error toggling user VIP status.', error);
  }
};

// Manage Reports
export const getReports = async (req: Request, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, username: true, email: true } },
        movie: { select: { id: true, title: true } },
        comment: { select: { id: true, content: true } },
      },
    });
    return res.json(reports);
  } catch (error: any) {
    return internalError(res, 'Error retrieving reports.', error);
  }
};

export const resolveReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // Resolved, Ignored, Pending
  if (!['Resolved', 'Ignored', 'Pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid report status.' });
  }

  try {
    const report = await prisma.report.update({
      where: { id },
      data: { status },
    });
    return res.json({ message: 'Report status updated.', report });
  } catch (error: any) {
    return internalError(res, 'Error updating report.', error);
  }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { roleName } = req.body; // e.g. "USER" or "ADMIN"

  if (req.user?.id === id) {
    return res.status(400).json({ message: 'Bạn không thể tự thay đổi vai trò của tài khoản đang đăng nhập.' });
  }

  if (!['USER', 'ADMIN'].includes(roleName)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ.' });
  }

  try {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(400).json({ message: 'Không tìm thấy vai trò tương ứng trong hệ thống.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        isVerified: true,
        isLocked: true,
        isVip: true,
        vipExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    return res.json({
      message: `Đã thay đổi vai trò của người dùng thành ${roleName} thành công.`,
      user: updatedUser,
    });
  } catch (error: any) {
    return internalError(res, 'Lỗi hệ thống khi cập nhật vai trò người dùng.', error);
  }
};
