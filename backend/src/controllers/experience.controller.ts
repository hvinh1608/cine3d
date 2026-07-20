import { Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';
import { ensureMovieInDb } from '../services/movie.upsert';
import { getPushPublicKey, pushConfigured } from '../services/push.service';

const movieInclude = {
  country: true,
  movieGenres: { include: { genre: true } },
} satisfies Prisma.MovieInclude;

async function resolveMovieId(reference: string) {
  const movie = await prisma.movie.findFirst({
    where: { OR: [{ id: reference }, { slug: reference }] },
    select: { id: true },
  });
  return movie?.id || (await ensureMovieInDb(reference)).id;
}

export const getFollows = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const follows = await prisma.movieFollow.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { movie: { include: movieInclude } },
      take: 200,
    });
    return res.json(follows.map((entry) => entry.movie));
  } catch (error) {
    return internalError(res, 'Không thể tải danh sách phim đang theo dõi.', error);
  }
};

export const getFollowStatus = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const movieId = await resolveMovieId(req.params.movieId);
    const follow = await prisma.movieFollow.findUnique({ where: { userId_movieId: { userId: req.user.id, movieId } } });
    return res.json({ following: Boolean(follow), movieId });
  } catch (error) {
    return internalError(res, 'Không thể kiểm tra trạng thái theo dõi.', error);
  }
};

export const toggleFollow = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const movieId = await resolveMovieId(req.params.movieId);
    const existing = await prisma.movieFollow.findUnique({ where: { userId_movieId: { userId: req.user.id, movieId } } });
    if (existing) {
      await prisma.movieFollow.delete({ where: { id: existing.id } });
      return res.json({ following: false, movieId, message: 'Đã dừng theo dõi phim.' });
    }
    await prisma.movieFollow.create({ data: { userId: req.user.id, movieId } });
    return res.json({ following: true, movieId, message: 'Đã theo dõi. Bạn sẽ nhận thông báo khi có tập mới.' });
  } catch (error) {
    return internalError(res, 'Không thể cập nhật theo dõi phim.', error);
  }
};

const playlistWithItems = {
  items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: { movie: { include: movieInclude } } },
  _count: { select: { items: true } },
} satisfies Prisma.PlaylistInclude;

export const getPlaylists = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    return res.json(await prisma.playlist.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: playlistWithItems,
      take: 50,
    }));
  } catch (error) {
    return internalError(res, 'Không thể tải playlist.', error);
  }
};

export const getPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: { ...playlistWithItems, user: { select: { username: true, avatar: true } } },
    });
    if (!playlist || (!playlist.isPublic && playlist.userId !== req.user?.id)) return res.status(404).json({ message: 'Không tìm thấy playlist.' });
    return res.json(playlist);
  } catch (error) {
    return internalError(res, 'Không thể tải playlist.', error);
  }
};

export const createPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) : null;
  if (!name || name.length > 60) return res.status(400).json({ message: 'Tên playlist phải từ 1 đến 60 ký tự.' });
  try {
    const count = await prisma.playlist.count({ where: { userId: req.user.id } });
    if (count >= 50) return res.status(400).json({ message: 'Bạn đã đạt giới hạn 50 playlist.' });
    const playlist = await prisma.playlist.create({
      data: { userId: req.user.id, name, description, isPublic: Boolean(req.body.isPublic) },
      include: playlistWithItems,
    });
    return res.status(201).json(playlist);
  } catch (error) {
    return internalError(res, 'Không thể tạo playlist.', error);
  }
};

export const updatePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  if (name !== undefined && (!name || name.length > 60)) return res.status(400).json({ message: 'Tên playlist phải từ 1 đến 60 ký tự.' });
  try {
    const existing = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy playlist.' });
    const playlist = await prisma.playlist.update({
      where: { id: existing.id },
      data: {
        name,
        description: req.body.description === undefined ? undefined : String(req.body.description).trim().slice(0, 500) || null,
        isPublic: req.body.isPublic === undefined ? undefined : Boolean(req.body.isPublic),
      },
      include: playlistWithItems,
    });
    return res.json(playlist);
  } catch (error) {
    return internalError(res, 'Không thể cập nhật playlist.', error);
  }
};

export const deletePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const existing = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy playlist.' });
    await prisma.playlist.delete({ where: { id: existing.id } });
    return res.json({ message: 'Đã xóa playlist.' });
  } catch (error) {
    return internalError(res, 'Không thể xóa playlist.', error);
  }
};

export const addPlaylistMovie = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { _count: { select: { items: true } } } });
    if (!playlist) return res.status(404).json({ message: 'Không tìm thấy playlist.' });
    if (playlist._count.items >= 200) return res.status(400).json({ message: 'Playlist đã đạt giới hạn 200 phim.' });
    const movieId = await resolveMovieId(req.params.movieId);
    const item = await prisma.playlistItem.upsert({
      where: { playlistId_movieId: { playlistId: playlist.id, movieId } },
      update: {},
      create: { playlistId: playlist.id, movieId, position: playlist._count.items },
      include: { movie: { include: movieInclude } },
    });
    await prisma.playlist.update({ where: { id: playlist.id }, data: { updatedAt: new Date() } });
    return res.status(201).json({ message: 'Đã thêm phim vào playlist.', item });
  } catch (error) {
    return internalError(res, 'Không thể thêm phim vào playlist.', error);
  }
};

export const removePlaylistMovie = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!playlist) return res.status(404).json({ message: 'Không tìm thấy playlist.' });
    const movieId = await resolveMovieId(req.params.movieId);
    await prisma.playlistItem.deleteMany({ where: { playlistId: playlist.id, movieId } });
    await prisma.playlist.update({ where: { id: playlist.id }, data: { updatedAt: new Date() } });
    return res.json({ message: 'Đã xóa phim khỏi playlist.' });
  } catch (error) {
    return internalError(res, 'Không thể xóa phim khỏi playlist.', error);
  }
};

export const getPushKey = (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ publicKey: getPushPublicKey(), configured: pushConfigured });
};

export const subscribePush = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const endpoint = req.body?.endpoint;
  const p256dh = req.body?.keys?.p256dh;
  const auth = req.body?.keys?.auth;
  if (![endpoint, p256dh, auth].every((value) => typeof value === 'string' && value.length > 10)) {
    return res.status(400).json({ message: 'Push subscription không hợp lệ.' });
  }
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user.id, p256dh, auth },
      create: { userId: req.user.id, endpoint, p256dh, auth },
    });
    return res.status(201).json({ message: 'Đã bật thông báo trên thiết bị này.' });
  } catch (error) {
    return internalError(res, 'Không thể lưu đăng ký thông báo.', error);
  }
};

export const unsubscribePush = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const endpoint = typeof req.body.endpoint === 'string' ? req.body.endpoint : '';
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
    return res.json({ message: 'Đã tắt thông báo trên thiết bị này.' });
  } catch (error) {
    return internalError(res, 'Không thể tắt thông báo.', error);
  }
};

const analyticsNames = new Set(['page_view', 'movie_play', 'movie_complete', 'player_error', 'player_startup', 'player_buffer', 'server_fallback', 'search', 'watch_room_create', 'watch_room_join']);
export const trackAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!analyticsNames.has(name)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  let metadata = req.body.metadata;
  if (metadata !== undefined && JSON.stringify(metadata).length > 4000) metadata = undefined;
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: req.user?.id || null,
        name,
        path: typeof req.body.path === 'string' ? req.body.path.slice(0, 300) : null,
        movieId: typeof req.body.movieId === 'string' ? req.body.movieId.slice(0, 100) : null,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
    return res.status(202).json({ accepted: true });
  } catch (error) {
    return internalError(res, 'Không thể ghi nhận sự kiện.', error);
  }
};

export const getAnalyticsSummary = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [grouped, recentErrors, recentQualityEvents, activeUsers] = await Promise.all([
      prisma.analyticsEvent.groupBy({ by: ['name'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.analyticsEvent.findMany({ where: { name: 'player_error', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.analyticsEvent.findMany({ where: { name: { in: ['player_startup', 'player_buffer', 'server_fallback'] }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
    ]);
    return res.json({
      periodDays: 7,
      events: Object.fromEntries(grouped.map((entry) => [entry.name, entry._count._all])),
      activeUsers: activeUsers.length,
      recentPlayerErrors: recentErrors,
      recentQualityEvents,
    });
  } catch (error) {
    return internalError(res, 'Không thể tải thống kê.', error);
  }
};

function currentRefreshHash(req: AuthenticatedRequest) {
  const raw = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('cine3d_refresh='))?.split('=').slice(1).join('=');
  const nativeToken = req.get('x-refresh-token')?.trim();
  const token = raw ? decodeURIComponent(raw) : nativeToken;
  return token ? crypto.createHash('sha256').update(token).digest('hex') : null;
}

export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const currentHash = currentRefreshHash(req);
    const sessions = await prisma.refreshToken.findMany({ where: { userId: req.user.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } });
    return res.json(sessions.map(({ token, ...session }) => ({ ...session, current: token === currentHash })));
  } catch (error) {
    return internalError(res, 'Không thể tải danh sách thiết bị.', error);
  }
};

export const revokeSession = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const session = await prisma.refreshToken.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên đăng nhập.' });
    await prisma.refreshToken.delete({ where: { id: session.id } });
    return res.json({ message: 'Đã đăng xuất thiết bị.' });
  } catch (error) {
    return internalError(res, 'Không thể đăng xuất thiết bị.', error);
  }
};

export const revokeOtherSessions = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const currentHash = currentRefreshHash(req);
    const result = await prisma.refreshToken.deleteMany({ where: { userId: req.user.id, ...(currentHash ? { token: { not: currentHash } } : {}) } });
    return res.json({ message: `Đã đăng xuất ${result.count} thiết bị khác.` });
  } catch (error) {
    return internalError(res, 'Không thể đăng xuất các thiết bị khác.', error);
  }
};
