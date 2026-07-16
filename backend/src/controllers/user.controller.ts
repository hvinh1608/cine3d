import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { ensureMovieInDb } from '../services/movie.upsert';
import { internalError } from '../lib/http-error';
import { hasVipAccess } from '../lib/vip';
import { getOwnedProfileId, hasRequestedProfile } from '../lib/profile';


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

    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatar: true, isVip: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } },
      });

      if (!dbUser) return res.status(404).json({ message: 'User not found.' });

      if (dbUser.avatar !== avatar) {
        const isVip = hasVipAccess(dbUser);
        if (!isVip && !PRESET_AVATARS.includes(avatar)) {
          return res.status(403).json({ message: 'Chỉ tài khoản VIP mới được sử dụng avatar tự chọn.' });
        }
      }
    } catch (error: any) {
      return internalError(res, 'Error checking user VIP status.', error);
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
        isVip: hasVipAccess(updated),
        vipExpiresAt: updated.vipExpiresAt,
        role: updated.role.name,
      },
    });
  } catch (error: any) {
    return internalError(res, 'Error updating profile.', error);
  }
};

export const getPlayerPreferences = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { playerPreferences: true } });
    return res.json(user?.playerPreferences || {});
  } catch (error) { return internalError(res, 'Không thể tải thiết lập trình phát.', error); }
};

export const updatePlayerPreferences = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const autoNext = typeof req.body.autoNext === 'boolean' ? req.body.autoNext : true;
  const style = req.body.subtitleStyle || {};
  const preferences = {
    autoNext,
    subtitleStyle: {
      fontSize: Math.min(160, Math.max(75, Number(style.fontSize) || 100)),
      color: /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#ffffff',
      background: Math.min(100, Math.max(0, Number(style.background) || 0)),
      offset: Math.min(10, Math.max(-10, Number(style.offset) || 0)),
      position: Math.min(95, Math.max(50, Number(style.position) || 85)),
    },
  };
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { playerPreferences: preferences } });
    return res.json(preferences);
  } catch (error) { return internalError(res, 'Không thể lưu thiết lập trình phát.', error); }
};

// Favorites
export const getFavorites = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    if (profileId) {
      const favorites = await prisma.profileFavorite.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { movie: { include: { country: true, movieGenres: { include: { genre: true } } } } },
      });
      return res.json(favorites.map((favorite) => favorite.movie));
    }

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
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });

    if (profileId) {
      const existing = await prisma.profileFavorite.findUnique({ where: { profileId_movieId: { profileId, movieId } } });
      if (existing) {
        await prisma.profileFavorite.delete({ where: { id: existing.id } });
        return res.json({ favorited: false, movieId, message: 'Đã bỏ yêu thích.' });
      }
      await prisma.profileFavorite.create({ data: { profileId, movieId } });
      return res.json({ favorited: true, movieId, message: 'Đã thêm vào phim yêu thích.' });
    }

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
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    if (profileId) {
      const watchlist = await prisma.profileWatchlist.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { movie: { include: { country: true, movieGenres: { include: { genre: true } } } } },
      });
      return res.json(watchlist.map((entry) => entry.movie));
    }

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
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });

    if (profileId) {
      const existing = await prisma.profileWatchlist.findUnique({ where: { profileId_movieId: { profileId, movieId } } });
      if (existing) {
        await prisma.profileWatchlist.delete({ where: { id: existing.id } });
        return res.json({ inWatchlist: false, movieId, message: 'Đã xóa khỏi danh sách.' });
      }
      await prisma.profileWatchlist.create({ data: { profileId, movieId } });
      return res.json({ inWatchlist: true, movieId, message: 'Đã thêm vào danh sách.' });
    }

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
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    if (profileId) {
      const history = await prisma.profileWatchHistory.findMany({
        where: { profileId },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: { movie: { include: { country: true, movieGenres: { include: { genre: true } }, episodes: true } } },
      });
      return res.json(history);
    }

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

export const getViewingInsights = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    const include = { movie: { include: { movieGenres: { include: { genre: true } } } } } as const;
    const history = profileId
      ? await prisma.profileWatchHistory.findMany({ where: { profileId }, include })
      : await prisma.watchHistory.findMany({ where: { userId: req.user.id }, include });
    const totalSeconds = history.reduce((sum, item) => sum + Math.min(item.watchedTime, item.duration || item.watchedTime), 0);
    const completedMovies = history.filter((item) => item.duration > 0 && item.watchedTime / item.duration >= 0.9).length;
    const genreCounts = new Map<string, number>();
    history.forEach((item) => item.movie.movieGenres.forEach(({ genre }) => genreCounts.set(genre.name, (genreCounts.get(genre.name) || 0) + 1)));
    const favoriteGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
    const activityDays = new Set(history.map((item) => item.updatedAt.toISOString().slice(0, 10)));
    let streakDays = 0;
    const cursor = new Date();
    while (activityDays.has(cursor.toISOString().slice(0, 10))) { streakDays += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    const badges = [
      { id: 'first_movie', name: 'Khởi đầu điện ảnh', description: 'Xem bộ phim đầu tiên', unlocked: history.length >= 1 },
      { id: 'five_movies', name: 'Mọt phim tập sự', description: 'Xem 5 bộ phim', unlocked: history.length >= 5 },
      { id: 'ten_hours', name: 'Đêm điện ảnh', description: 'Xem tổng cộng 10 giờ', unlocked: totalSeconds >= 10 * 3600 },
      { id: 'finisher', name: 'Cày trọn bộ', description: 'Hoàn thành 3 phim', unlocked: completedMovies >= 3 },
      { id: 'streak_7', name: 'Không thể rời mắt', description: 'Hoạt động 7 ngày liên tiếp', unlocked: streakDays >= 7 },
    ];
    return res.json({ totalHours: Number((totalSeconds / 3600).toFixed(1)), moviesStarted: history.length, completedMovies, streakDays, favoriteGenres, badges });
  } catch (error) { return internalError(res, 'Không thể tải thống kê xem phim.', error); }
};

export const saveWatchProgress = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId: movieRef, episodeId, watchedTime, duration } = req.body;

  if (!movieRef || watchedTime === undefined || duration === undefined) {
    return res.status(400).json({ message: 'movieId, watchedTime, and duration are required.' });
  }

  try {
    const movieId = await resolveMovieId(movieRef);
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });

    const parsedTime = Number(watchedTime);
    const parsedDuration = Number(duration);
    if (!Number.isFinite(parsedTime) || !Number.isFinite(parsedDuration) || parsedTime < 0 || parsedDuration < 0) {
      return res.status(400).json({ message: 'watchedTime and duration must be non-negative numbers.' });
    }

    if (episodeId) {
      const episode = await prisma.episode.findFirst({ where: { id: episodeId, movieId }, select: { id: true } });
      if (!episode) return res.status(400).json({ message: 'Episode does not belong to this movie.' });
    }

    const progress = profileId
      ? await prisma.profileWatchHistory.upsert({
          where: { profileId_movieId: { profileId, movieId } },
          update: {
            episodeId: episodeId || null,
            watchedTime: Math.floor(parsedTime),
            duration: Math.floor(parsedDuration),
          },
          create: {
            profileId,
            movieId,
            episodeId: episodeId || null,
            watchedTime: Math.floor(parsedTime),
            duration: Math.floor(parsedDuration),
          },
        })
      : await prisma.watchHistory.upsert({
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
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    if (profileId) {
      const existing = await prisma.profileWatchHistory.findFirst({ where: { id, profileId } });
      if (!existing) return res.status(404).json({ message: 'History record not found.' });
      await prisma.profileWatchHistory.delete({ where: { id } });
      return res.json({ message: 'Watch history record deleted.', deletedId: id });
    }

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

export const deleteWatchHistoryBulk = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const ids: string[] = Array.isArray(req.body.ids) ? [...new Set<string>(req.body.ids.filter((id: unknown): id is string => typeof id === 'string'))].slice(0, 100) : [];
  const clearAll = req.body.all === true;
  if (!clearAll && !ids.length) return res.status(400).json({ message: 'Chọn ít nhất một mục lịch sử.' });
  try {
    const profileId = await getOwnedProfileId(req);
    if (hasRequestedProfile(req) && !profileId) return res.status(403).json({ message: 'Hồ sơ không hợp lệ.' });
    const result = profileId
      ? await prisma.profileWatchHistory.deleteMany({ where: { profileId, ...(clearAll ? {} : { id: { in: ids } }) } })
      : await prisma.watchHistory.deleteMany({ where: { userId: req.user.id, ...(clearAll ? {} : { id: { in: ids } }) } });
    return res.json({ deleted: result.count });
  } catch (error) { return internalError(res, 'Không thể xóa lịch sử xem.', error); }
};

// --- Preset Avatars for Verification ---
export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80',
];

// --- Multer Storage configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const userId = (req as any).user?.id || 'guest';
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên các định dạng ảnh: JPEG, PNG, WEBP, GIF.'));
    }
  },
}).single('avatar');

// --- Custom Upload Avatar Controller ---
export const uploadAvatar = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const userId = req.user.id;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isVip: true, vipExpiresAt: true, isLocked: true, avatar: true, role: { select: { name: true } } },
    });

    if (!dbUser) return res.status(404).json({ message: 'User not found.' });

    const isVip = hasVipAccess(dbUser);
    if (!isVip) {
      return res.status(403).json({ message: 'Tính năng tải lên ảnh đại diện tự chọn chỉ dành cho tài khoản VIP.' });
    }

    upload(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Lỗi tải file lên.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng chọn một file ảnh để tải lên.' });
      }

      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

      // Xóa file avatar cũ nếu đó là file tải lên cục bộ để tránh rác máy chủ
      if (dbUser.avatar && dbUser.avatar.includes('/uploads/avatars/')) {
        const oldFilename = dbUser.avatar.split('/uploads/avatars/')[1];
        if (oldFilename) {
          const oldFilePath = path.join(__dirname, '../../uploads/avatars', oldFilename);
          fs.unlink(oldFilePath, (unlinkErr) => {
            if (unlinkErr) {
              console.warn(`Không thể xóa file avatar cũ: ${oldFilePath}. Lỗi: ${unlinkErr.message}`);
            } else {
              console.log(`Đã dọn dẹp file avatar cũ: ${oldFilename}`);
            }
          });
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { avatar: publicUrl },
        include: { role: true },
      });

      return res.json({
        message: 'Tải ảnh đại diện mới thành công.',
        avatar: publicUrl,
        user: {
          id: updated.id,
          email: updated.email,
          username: updated.username,
          avatar: updated.avatar,
          isVip: hasVipAccess(updated),
          vipExpiresAt: updated.vipExpiresAt,
          role: updated.role.name,
        },
      });
    });
  } catch (error: any) {
    return internalError(res, 'Error processing avatar upload.', error);
  }
};
