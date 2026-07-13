import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { ensureMovieInDb } from '../services/movie.upsert';
import { internalError } from '../lib/http-error';


/** Resolve UUID or KKPhim slug to a DB movie id (upsert from KKPhim if needed). */
async function resolveMovieId(movieIdOrSlug: string): Promise<string> {
  const byId = await prisma.movie.findUnique({ where: { id: movieIdOrSlug }, select: { id: true } });
  if (byId) return byId.id;

  const bySlug = await prisma.movie.findUnique({ where: { slug: movieIdOrSlug }, select: { id: true } });
  if (bySlug) return bySlug.id;

  const upserted = await ensureMovieInDb(movieIdOrSlug);
  return upserted.id;
}

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { username, avatar } = req.body;

  if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 40)) {
    return res.status(400).json({ message: 'Username must be between 3 and 40 characters.' });
  }
  if (avatar) {
    try {
      const parsed = new URL(avatar);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch {
      return res.status(400).json({ message: 'Avatar must be a valid HTTP(S) URL.' });
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        username: username?.trim() || undefined,
        avatar: avatar || undefined,
      },
      include: { role: true },
    });

    return res.json({
      message: 'Profile updated successfully.',
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        avatar: updated.avatar,
        role: updated.role.name,
      },
    });
  } catch (error: any) {
    return internalError(res, 'Error updating profile.', error);
  }
};

// Favorites
export const getFavorites = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        movie: {
          include: {
            country: true,
            movieGenres: { include: { genre: true } },
          },
        },
      },
    });

    return res.json(favorites.map((f) => f.movie));
  } catch (error: any) {
    return internalError(res, 'Error retrieving favorites.', error);
  }
};

export const toggleFavorite = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId: movieRef } = req.params;

  try {
    const movieId = await resolveMovieId(movieRef);

    const existing = await prisma.favorite.findUnique({
      where: {
        movieId_userId: {
          movieId,
          userId: req.user.id,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id },
      });
      return res.json({ favorited: false, movieId, message: 'Removed from favorites.' });
    } else {
      await prisma.favorite.create({
        data: {
          movieId,
          userId: req.user.id,
        },
      });
      return res.json({ favorited: true, movieId, message: 'Added to favorites.' });
    }
  } catch (error: any) {
    return internalError(res, 'Error updating favorite.', error);
  }
};

// Watchlist
export const getWatchlist = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        movie: {
          include: {
            country: true,
            movieGenres: { include: { genre: true } },
          },
        },
      },
    });

    return res.json(watchlist.map((w) => w.movie));
  } catch (error: any) {
    return internalError(res, 'Error retrieving watchlist.', error);
  }
};

export const toggleWatchlist = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId: movieRef } = req.params;

  try {
    const movieId = await resolveMovieId(movieRef);

    const existing = await prisma.watchlist.findUnique({
      where: {
        movieId_userId: {
          movieId,
          userId: req.user.id,
        },
      },
    });

    if (existing) {
      await prisma.watchlist.delete({
        where: { id: existing.id },
      });
      return res.json({ inWatchlist: false, movieId, message: 'Removed from watchlist.' });
    } else {
      await prisma.watchlist.create({
        data: {
          movieId,
          userId: req.user.id,
        },
      });
      return res.json({ inWatchlist: true, movieId, message: 'Added to watchlist.' });
    }
  } catch (error: any) {
    return internalError(res, 'Error updating watchlist.', error);
  }
};

// Watch History
export const getWatchHistory = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    const history = await prisma.watchHistory.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        movie: {
          include: {
            country: true,
            movieGenres: { include: { genre: true } },
            episodes: true,
          },
        },
      },
    });

    return res.json(history);
  } catch (error: any) {
    return internalError(res, 'Error retrieving watch history.', error);
  }
};

export const saveWatchProgress = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId: movieRef, episodeId, watchedTime, duration } = req.body;

  if (!movieRef || watchedTime === undefined || duration === undefined) {
    return res.status(400).json({ message: 'movieId, watchedTime, and duration are required.' });
  }

  try {
    const movieId = await resolveMovieId(movieRef);

    const parsedTime = Number(watchedTime);
    const parsedDuration = Number(duration);
    if (!Number.isFinite(parsedTime) || !Number.isFinite(parsedDuration) || parsedTime < 0 || parsedDuration < 0) {
      return res.status(400).json({ message: 'watchedTime and duration must be non-negative numbers.' });
    }

    if (episodeId) {
      const episode = await prisma.episode.findFirst({ where: { id: episodeId, movieId }, select: { id: true } });
      if (!episode) return res.status(400).json({ message: 'Episode does not belong to this movie.' });
    }

    const progress = await prisma.watchHistory.upsert({
      where: { movieId_userId: { movieId, userId: req.user.id } },
      update: {
        episodeId: episodeId || null,
        watchedTime: Math.floor(parsedTime),
        duration: Math.floor(parsedDuration),
      },
      create: {
        userId: req.user.id,
        movieId,
        episodeId: episodeId || null,
        watchedTime: Math.floor(parsedTime),
        duration: Math.floor(parsedDuration),
      },
    });
    return res.json({ message: 'Watch progress saved.', progress });
  } catch (error: any) {
    return internalError(res, 'Error saving watch progress.', error);
  }
};

// Notifications
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(notifications);
  } catch (error: any) {
    return internalError(res, 'Error retrieving notifications.', error);
  }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { id } = req.params;

  try {
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return res.json(notification);
  } catch (error: any) {
    return internalError(res, 'Error updating notification status.', error);
  }
};

export const deleteWatchHistory = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { id } = req.params;

  try {
    const existing = await prisma.watchHistory.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'History record not found.' });
    }

    await prisma.watchHistory.delete({
      where: { id },
    });

    return res.json({ message: 'Watch history record deleted.', deletedId: id });
  } catch (error: any) {
    return internalError(res, 'Error deleting watch history.', error);
  }
};
