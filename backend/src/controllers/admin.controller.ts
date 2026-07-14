import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';
import { AuthenticatedRequest } from '../middleware/auth';


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
    const movies = await prisma.movie.findMany({
      include: {
        country: true,
        movieGenres: { include: { genre: true } },
        episodes: { include: { videoSources: true, subtitles: true }, orderBy: { episodeOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json(movies);
  } catch (error: any) {
    return internalError(res, 'Error retrieving local movies.', error);
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
    status,
    countryId,
    genreIds, // string[]
    actorIds, // string[]
    directorIds, // string[]
    isFeatured,
    isTrending,
    isProposed,
    isVip,
  } = req.body;

  if (!title || !slug || !description || !backdropUrl || !posterUrl || !countryId) {
    return res.status(400).json({ message: 'Missing required movie fields.' });
  }

  try {
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
        status: status || 'Completed',
        isFeatured: isFeatured !== undefined ? !!isFeatured : false,
        isTrending: isTrending !== undefined ? !!isTrending : false,
        isProposed: isProposed !== undefined ? !!isProposed : false,
        isVip: isVip !== undefined ? !!isVip : false,
        countryId,
        movieGenres: {
          create: (genreIds || []).map((id: string) => ({ genreId: id })),
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
    return internalError(res, 'Error creating movie.', error);
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
    status,
    countryId,
    genreIds,
    actorIds,
    directorIds,
    isFeatured,
    isTrending,
    isProposed,
    isVip,
  } = req.body;

  try {
    const existingMovie = await prisma.movie.findUnique({ where: { id } });
    if (!existingMovie) return res.status(404).json({ message: 'Movie not found.' });

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
        status,
        isFeatured: isFeatured !== undefined ? !!isFeatured : undefined,
        isTrending: isTrending !== undefined ? !!isTrending : undefined,
        isProposed: isProposed !== undefined ? !!isProposed : undefined,
        isVip: isVip !== undefined ? !!isVip : undefined,
        countryId,
        movieGenres: genreIds
          ? {
              deleteMany: {},
              create: genreIds.map((gId: string) => ({ genreId: gId })),
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
    return internalError(res, 'Error updating movie.', error);
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
  const { movieId, title, episodeOrder, videoSources, subtitles } = req.body;

  if (!movieId || !title || episodeOrder === undefined) {
    return res.status(400).json({ message: 'movieId, title, and episodeOrder are required.' });
  }

  try {
    const episode = await prisma.episode.create({
      data: {
        movieId,
        title,
        episodeOrder: parseInt(episodeOrder, 10),
        videoSources: {
          create: (videoSources || []).map((src: any) => ({
            server: src.server,
            quality: src.quality,
            url: src.url,
            type: src.type || 'hls',
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

    return res.status(201).json({ message: 'Episode created successfully.', episode });
  } catch (error: any) {
    return internalError(res, 'Error creating episode.', error);
  }
};

export const updateEpisode = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, episodeOrder, videoSources, subtitles } = req.body;

  try {
    const existing = await prisma.episode.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Episode not found.' });

    const episode = await prisma.episode.update({
      where: { id },
      data: {
        title,
        episodeOrder: episodeOrder !== undefined ? parseInt(episodeOrder, 10) : undefined,
        videoSources: videoSources
          ? {
              deleteMany: {},
              create: videoSources.map((src: any) => ({
                server: src.server,
                quality: src.quality,
                url: src.url,
                type: src.type || 'hls',
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
