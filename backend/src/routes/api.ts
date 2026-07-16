import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireAdmin, optionalAuthenticate } from '../middleware/auth';
import {
  register,
  login,
  googleLogin,
  refresh,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from '../controllers/auth.controller';
import {
  getMovies,
  getMovieBySlug,
  incrementViews,
  getTrending,
  getProposed,
  getBanners,
  getHome,
  getPersonalizedRecommendations,
  getReleaseSchedule,
} from '../controllers/movie.controller';
import {
  updateProfile,
  getFavorites,
  toggleFavorite,
  getWatchlist,
  toggleWatchlist,
  getWatchHistory,
  saveWatchProgress,
  getNotifications,
  markNotificationRead,
  deleteWatchHistory,
  deleteWatchHistoryBulk,
  uploadAvatar,
  getPlayerPreferences,
  updatePlayerPreferences,
} from '../controllers/user.controller';
import {
  getComments,
  createComment,
  toggleLikeComment,
  togglePinComment,
  deleteComment,
  rateMovie,
  getMovieRatingByUser,
  reportContent,
} from '../controllers/community.controller';
import {
  getStats,
  getLocalMovies,
  getAdminCountries,
  getAdminGenres,
  createMovie,
  updateMovie,
  deleteMovie,
  createEpisode,
  createEpisodesBulk,
  updateEpisode,
  deleteEpisode,
  getVideoSourceHealth,
  checkVideoSources,
  getUsers,
  toggleUserLock,
  toggleUserVip,
  updateUserRole,
  getReports,
  resolveReport,
} from '../controllers/admin.controller';
import { fetchGenres, fetchCountries, KkphimError } from '../services/kkphim.client';
import { extractMetaItems } from '../services/kkphim.mapper';
import { rateLimit } from '../middleware/rate-limit';
import { internalError } from '../lib/http-error';
import { getPeopleFollowStatus, togglePeopleFollow } from '../controllers/people-follow.controller';
import {
  getVipPlans,
  createVipOrder,
  getMyVipOrders,
  cancelMyVipOrder,
  getAdminVipOrders,
  confirmVipOrder,
  cancelAdminVipOrder,
} from '../controllers/vip.controller';
import {
  getProfiles,
  createProfile,
  updateViewerProfile,
  verifyProfilePin,
  deleteViewerProfile,
} from '../controllers/profile.controller';
import {
  getFollows,
  getFollowStatus,
  toggleFollow,
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addPlaylistMovie,
  removePlaylistMovie,
  getPushKey,
  subscribePush,
  unsubscribePush,
  trackAnalytics,
  getAnalyticsSummary,
  getSessions,
  revokeSession,
  revokeOtherSessions,
} from '../controllers/experience.controller';

const router = Router();

// --- Auth Routes ---
const authLimiter = rateLimit(15 * 60 * 1000, 20);
const resetLimiter = rateLimit(60 * 60 * 1000, 5);
const interactionLimiter = rateLimit(60 * 1000, 60);
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.post('/auth/google', authLimiter, googleLogin);
router.post('/auth/refresh', rateLimit(60 * 1000, 30), refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticateToken as any, getProfile as any);
router.post('/auth/forgot-password', resetLimiter, forgotPassword as any);
router.post('/auth/reset-password', resetLimiter, resetPassword as any);
router.get('/auth/verify-email', resetLimiter, verifyEmail as any);
router.get('/auth/sessions', authenticateToken as any, getSessions as any);
router.delete('/auth/sessions/others', authenticateToken as any, revokeOtherSessions as any);
router.delete('/auth/sessions/:id', authenticateToken as any, revokeSession as any);

// --- Movie Routes ---
router.get('/movies', getMovies);
router.get('/movies/home', getHome);
router.get('/movies/trending', getTrending);
router.get('/movies/proposed', getProposed);
router.get('/movies/banners', getBanners);
router.get('/movies/recommendations/me', optionalAuthenticate as any, getPersonalizedRecommendations as any);
router.get('/schedule', getReleaseSchedule as any);
router.get('/movies/:slug', optionalAuthenticate as any, getMovieBySlug);
router.post('/movies/:id/view', rateLimit(60 * 1000, 20), incrementViews);

// --- User Routes ---
router.put('/user/profile', authenticateToken as any, updateProfile as any);
router.get('/user/player-preferences', authenticateToken as any, getPlayerPreferences as any);
router.put('/user/player-preferences', authenticateToken as any, updatePlayerPreferences as any);
router.post('/user/profile/avatar-upload', authenticateToken as any, uploadAvatar as any);
router.get('/user/favorites', authenticateToken as any, getFavorites as any);
router.post('/user/favorites/:movieId', authenticateToken as any, toggleFavorite as any);
router.get('/user/watchlist', authenticateToken as any, getWatchlist as any);
router.post('/user/watchlist/:movieId', authenticateToken as any, toggleWatchlist as any);
router.get('/user/history', authenticateToken as any, getWatchHistory as any);
router.post('/user/history', authenticateToken as any, saveWatchProgress as any);
router.delete('/user/history/:id', authenticateToken as any, deleteWatchHistory as any);
router.post('/user/history/bulk-delete', authenticateToken as any, deleteWatchHistoryBulk as any);
router.get('/user/notifications', authenticateToken as any, getNotifications as any);
router.put('/user/notifications/:id/read', authenticateToken as any, markNotificationRead as any);
router.get('/user/profiles', authenticateToken as any, getProfiles as any);
router.post('/user/profiles', authenticateToken as any, createProfile as any);
router.put('/user/profiles/:id', authenticateToken as any, updateViewerProfile as any);
router.post('/user/profiles/:id/verify-pin', authenticateToken as any, verifyProfilePin as any);
router.delete('/user/profiles/:id', authenticateToken as any, deleteViewerProfile as any);
router.get('/user/follows', authenticateToken as any, getFollows as any);
router.get('/user/follows/:movieId', authenticateToken as any, getFollowStatus as any);
router.post('/user/follows/:movieId', authenticateToken as any, toggleFollow as any);
router.get('/user/playlists', authenticateToken as any, getPlaylists as any);
router.post('/user/playlists', authenticateToken as any, createPlaylist as any);
router.put('/user/playlists/:id', authenticateToken as any, updatePlaylist as any);
router.delete('/user/playlists/:id', authenticateToken as any, deletePlaylist as any);
router.post('/user/playlists/:id/movies/:movieId', authenticateToken as any, addPlaylistMovie as any);
router.delete('/user/playlists/:id/movies/:movieId', authenticateToken as any, removePlaylistMovie as any);
router.get('/playlists/:id', optionalAuthenticate as any, getPlaylist as any);
router.get('/push/public-key', getPushKey as any);
router.post('/push/subscribe', authenticateToken as any, subscribePush as any);
router.delete('/push/subscribe', authenticateToken as any, unsubscribePush as any);
router.post('/analytics/events', rateLimit(60 * 1000, 120), optionalAuthenticate as any, trackAnalytics as any);

// --- VIP Checkout Routes ---
router.get('/vip/plans', getVipPlans as any);
router.post('/vip/orders', rateLimit(60 * 60 * 1000, 10), authenticateToken as any, createVipOrder as any);
router.get('/vip/orders/me', authenticateToken as any, getMyVipOrders as any);
router.post('/vip/orders/:id/cancel', authenticateToken as any, cancelMyVipOrder as any);

// --- Community / Interaction Routes ---
router.get('/movies/:movieId/comments', optionalAuthenticate as any, getComments as any);
router.post('/movies/:movieId/comments', interactionLimiter, authenticateToken as any, createComment as any);
router.post('/comments/:commentId/like', interactionLimiter, authenticateToken as any, toggleLikeComment as any);
router.put('/comments/:commentId/pin', authenticateToken as any, requireAdmin as any, togglePinComment as any);
router.delete('/comments/:commentId', authenticateToken as any, deleteComment as any);
router.post('/movies/:movieId/ratings', authenticateToken as any, rateMovie as any);
router.get('/movies/:movieId/ratings/me', authenticateToken as any, getMovieRatingByUser as any);
router.post('/reports', rateLimit(60 * 60 * 1000, 10), authenticateToken as any, reportContent as any);

// --- Helper Filter Routes ---
router.get('/genres', async (_req: Request, res: Response) => {
  try {
    const raw = await fetchGenres();
    return res.json(extractMetaItems(raw));
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving genres.', error, status);
  }
});

router.get('/countries', async (_req: Request, res: Response) => {
  try {
    const raw = await fetchCountries();
    return res.json(extractMetaItems(raw));
  } catch (error: any) {
    const status = error instanceof KkphimError ? error.status : 500;
    return internalError(res, 'Error retrieving countries.', error, status);
  }
});

router.get('/actors', async (req: Request, res: Response) => {
  try {
    const actors = await prisma.actor.findMany({ orderBy: { name: 'asc' } });
    return res.json(actors);
  } catch (error: any) {
    return internalError(res, 'Error retrieving actors.', error);
  }
});
router.get('/actors/:slug', async (req: Request, res: Response) => {
  try {
    const actor = await prisma.actor.findUnique({ where: { slug: req.params.slug }, include: { movieActors: { include: { movie: true }, orderBy: { createdAt: 'desc' } } } });
    if (!actor) return res.status(404).json({ message: 'Không tìm thấy diễn viên.' });
    return res.json({ ...actor, movies: actor.movieActors.map((item) => item.movie) });
  } catch (error) { return internalError(res, 'Không thể tải diễn viên.', error); }
});

router.get('/directors', async (req: Request, res: Response) => {
  try {
    const directors = await prisma.director.findMany({ orderBy: { name: 'asc' } });
    return res.json(directors);
  } catch (error: any) {
    return internalError(res, 'Error retrieving directors.', error);
  }
});
router.get('/directors/:slug', async (req: Request, res: Response) => {
  try {
    const director = await prisma.director.findUnique({ where: { slug: req.params.slug }, include: { movieDirectors: { include: { movie: true }, orderBy: { createdAt: 'desc' } } } });
    if (!director) return res.status(404).json({ message: 'Không tìm thấy đạo diễn.' });
    return res.json({ ...director, movies: director.movieDirectors.map((item) => item.movie) });
  } catch (error) { return internalError(res, 'Không thể tải đạo diễn.', error); }
});
router.get('/people/:kind/:id/follow', authenticateToken as any, getPeopleFollowStatus as any);
router.post('/people/:kind/:id/follow', authenticateToken as any, togglePeopleFollow as any);

// --- Admin Routes ---
router.get('/admin/stats', authenticateToken as any, requireAdmin as any, getStats);
router.get('/admin/analytics', authenticateToken as any, requireAdmin as any, getAnalyticsSummary as any);
router.get('/admin/movies', authenticateToken as any, requireAdmin as any, getLocalMovies);
router.get('/admin/countries', authenticateToken as any, requireAdmin as any, getAdminCountries);
router.get('/admin/genres', authenticateToken as any, requireAdmin as any, getAdminGenres);
router.post('/admin/movies', authenticateToken as any, requireAdmin as any, createMovie);
router.put('/admin/movies/:id', authenticateToken as any, requireAdmin as any, updateMovie);
router.delete('/admin/movies/:id', authenticateToken as any, requireAdmin as any, deleteMovie);
router.post('/admin/episodes', authenticateToken as any, requireAdmin as any, createEpisode);
router.post('/admin/episodes/bulk', authenticateToken as any, requireAdmin as any, createEpisodesBulk as any);
router.put('/admin/episodes/:id', authenticateToken as any, requireAdmin as any, updateEpisode);
router.delete('/admin/episodes/:id', authenticateToken as any, requireAdmin as any, deleteEpisode);
router.get('/admin/source-health', authenticateToken as any, requireAdmin as any, getVideoSourceHealth as any);
router.post('/admin/source-health/check', authenticateToken as any, requireAdmin as any, checkVideoSources as any);
router.post('/admin/source-health/:id/check', authenticateToken as any, requireAdmin as any, checkVideoSources as any);
router.get('/admin/users', authenticateToken as any, requireAdmin as any, getUsers);
router.put('/admin/users/:id/lock', authenticateToken as any, requireAdmin as any, toggleUserLock);
router.put('/admin/users/:id/vip', authenticateToken as any, requireAdmin as any, toggleUserVip);
router.put('/admin/users/:id/role', authenticateToken as any, requireAdmin as any, updateUserRole as any);
router.get('/admin/reports', authenticateToken as any, requireAdmin as any, getReports);
router.put('/admin/reports/:id/resolve', authenticateToken as any, requireAdmin as any, resolveReport);
router.get('/admin/vip-orders', authenticateToken as any, requireAdmin as any, getAdminVipOrders as any);
router.post('/admin/vip-orders/:id/confirm', authenticateToken as any, requireAdmin as any, confirmVipOrder as any);
router.post('/admin/vip-orders/:id/cancel', authenticateToken as any, requireAdmin as any, cancelAdminVipOrder as any);

export default router;
