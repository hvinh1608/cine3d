import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireAdmin, optionalAuthenticate } from '../middleware/auth';
import {
  register,
  login,
  refresh,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import {
  getMovies,
  getMovieBySlug,
  incrementViews,
  getTrending,
  getProposed,
  getBanners,
  getHome,
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
} from '../controllers/user.controller';
import {
  getComments,
  createComment,
  toggleLikeComment,
  deleteComment,
  rateMovie,
  getMovieRatingByUser,
  reportContent,
} from '../controllers/community.controller';
import {
  getStats,
  getLocalMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  getUsers,
  toggleUserLock,
  toggleUserVip,
  getReports,
  resolveReport,
} from '../controllers/admin.controller';
import { fetchGenres, fetchCountries, KkphimError } from '../services/kkphim.client';
import { extractMetaItems } from '../services/kkphim.mapper';
import { rateLimit } from '../middleware/rate-limit';
import { internalError } from '../lib/http-error';
import {
  getVipPlans,
  createVipOrder,
  getMyVipOrders,
  cancelMyVipOrder,
  getAdminVipOrders,
  confirmMockVipOrder,
  cancelAdminVipOrder,
} from '../controllers/vip.controller';

const router = Router();

// --- Auth Routes ---
const authLimiter = rateLimit(15 * 60 * 1000, 20);
const resetLimiter = rateLimit(60 * 60 * 1000, 5);
const interactionLimiter = rateLimit(60 * 1000, 60);
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.post('/auth/refresh', rateLimit(60 * 1000, 30), refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticateToken as any, getProfile as any);
router.post('/auth/forgot-password', resetLimiter, forgotPassword as any);
router.post('/auth/reset-password', resetLimiter, resetPassword as any);

// --- Movie Routes ---
router.get('/movies', getMovies);
router.get('/movies/home', getHome);
router.get('/movies/trending', getTrending);
router.get('/movies/proposed', getProposed);
router.get('/movies/banners', getBanners);
router.get('/movies/:slug', optionalAuthenticate as any, getMovieBySlug);
router.post('/movies/:id/view', rateLimit(60 * 1000, 20), incrementViews);

// --- User Routes ---
router.put('/user/profile', authenticateToken as any, updateProfile as any);
router.get('/user/favorites', authenticateToken as any, getFavorites as any);
router.post('/user/favorites/:movieId', authenticateToken as any, toggleFavorite as any);
router.get('/user/watchlist', authenticateToken as any, getWatchlist as any);
router.post('/user/watchlist/:movieId', authenticateToken as any, toggleWatchlist as any);
router.get('/user/history', authenticateToken as any, getWatchHistory as any);
router.post('/user/history', authenticateToken as any, saveWatchProgress as any);
router.delete('/user/history/:id', authenticateToken as any, deleteWatchHistory as any);
router.get('/user/notifications', authenticateToken as any, getNotifications as any);
router.put('/user/notifications/:id/read', authenticateToken as any, markNotificationRead as any);

// --- VIP Mock Checkout Routes ---
router.get('/vip/plans', getVipPlans as any);
router.post('/vip/orders', rateLimit(60 * 60 * 1000, 10), authenticateToken as any, createVipOrder as any);
router.get('/vip/orders/me', authenticateToken as any, getMyVipOrders as any);
router.post('/vip/orders/:id/cancel', authenticateToken as any, cancelMyVipOrder as any);

// --- Community / Interaction Routes ---
router.get('/movies/:movieId/comments', optionalAuthenticate as any, getComments as any);
router.post('/movies/:movieId/comments', interactionLimiter, authenticateToken as any, createComment as any);
router.post('/comments/:commentId/like', interactionLimiter, authenticateToken as any, toggleLikeComment as any);
router.delete('/comments/:commentId', authenticateToken as any, deleteComment as any);
router.post('/movies/:movieId/ratings', authenticateToken as any, rateMovie as any);
router.get('/movies/:movieId/ratings/me', authenticateToken as any, getMovieRatingByUser as any);
router.post('/reports', rateLimit(60 * 60 * 1000, 10), authenticateToken as any, reportContent as any);

// --- Helper Filter Routes ---
router.get('/genres', async (_req: Request, res: Response) => {
  try {
    const genres = await prisma.genre.findMany({ orderBy: { name: 'asc' } });
    return res.json(genres);
  } catch (error: any) {
    return internalError(res, 'Error retrieving genres.', error);
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

router.get('/directors', async (req: Request, res: Response) => {
  try {
    const directors = await prisma.director.findMany({ orderBy: { name: 'asc' } });
    return res.json(directors);
  } catch (error: any) {
    return internalError(res, 'Error retrieving directors.', error);
  }
});

// --- Admin Routes ---
router.get('/admin/stats', authenticateToken as any, requireAdmin as any, getStats);
router.get('/admin/movies', authenticateToken as any, requireAdmin as any, getLocalMovies);
router.post('/admin/movies', authenticateToken as any, requireAdmin as any, createMovie);
router.put('/admin/movies/:id', authenticateToken as any, requireAdmin as any, updateMovie);
router.delete('/admin/movies/:id', authenticateToken as any, requireAdmin as any, deleteMovie);
router.post('/admin/episodes', authenticateToken as any, requireAdmin as any, createEpisode);
router.put('/admin/episodes/:id', authenticateToken as any, requireAdmin as any, updateEpisode);
router.delete('/admin/episodes/:id', authenticateToken as any, requireAdmin as any, deleteEpisode);
router.get('/admin/users', authenticateToken as any, requireAdmin as any, getUsers);
router.put('/admin/users/:id/lock', authenticateToken as any, requireAdmin as any, toggleUserLock);
router.put('/admin/users/:id/vip', authenticateToken as any, requireAdmin as any, toggleUserVip);
router.get('/admin/reports', authenticateToken as any, requireAdmin as any, getReports);
router.put('/admin/reports/:id/resolve', authenticateToken as any, requireAdmin as any, resolveReport);
router.get('/admin/vip-orders', authenticateToken as any, requireAdmin as any, getAdminVipOrders as any);
router.post('/admin/vip-orders/:id/confirm', authenticateToken as any, requireAdmin as any, confirmMockVipOrder as any);
router.post('/admin/vip-orders/:id/cancel', authenticateToken as any, requireAdmin as any, cancelAdminVipOrder as any);

export default router;
