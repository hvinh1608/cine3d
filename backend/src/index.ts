import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server as SocketServer, Socket } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import apiRouter from './routes/api';
import { prisma } from './lib/prisma';
import { sendPushToUsers } from './services/push.service';
import { checkDueVideoSources } from './services/source-health.service';
import { decodeAccessToken } from './middleware/auth';
import { hasVipAccess } from './lib/vip';
import { cacheDelete, cacheSet, closeRedis, redisStatus } from './lib/redis';
import { issueRoomAccessToken, verifyRoomAccessToken } from './lib/watch-room-token';

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
const allowedOrigins = new Set([
  'http://localhost:3000',
  'https://cine3d.vercel.app',
  'https://cine3d.id.vn',
  'https://www.cine3d.id.vn',
  ...(process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

// Global Middlewares
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin are server-to-server/health checks.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Profile-Id',
      'X-Client-Type',
      'X-App-Attestation',
      process.env.GOOGLE_PLAY_RTDN_SECRET_HEADER?.trim() || 'X-Google-RTDN-Secret',
    ],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Public catalog responses can be reused briefly by browsers and edge caches.
// Catalog list/home get Cache-Control only on successful handlers (see movie.controller).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && (req.path === '/genres' || req.path === '/countries')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  }
  next();
});

// Static Files Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  setHeaders(res) {
    // The frontend and API use different subdomains, so legacy uploaded avatars must be embeddable cross-origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// API Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'connected', redis: await redisStatus(), timestamp: new Date() });
  } catch (error) {
    console.error('Database health check failed.', error);
    res.status(503).json({ status: 'ERROR', database: 'unavailable', timestamp: new Date() });
  }
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Error handling middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const details = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    message: 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' ? { error: details } : {}),
  });
});

const server = createServer(app);
const io = new SocketServer(server, { cors: { origin: [...allowedOrigins], credentials: true } });
io.use(async (socket, next) => {
  const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  if (!token) return next(new Error('AUTH_REQUIRED'));
  try {
    const decoded = decodeAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, username: true, isVip: true, vipExpiresAt: true, isLocked: true, role: { select: { name: true } } } });
    if (!user || user.isLocked) return next(new Error('ACCOUNT_UNAVAILABLE'));
    socket.data.user = { id: user.id, username: user.username, canAccessVip: hasVipAccess(user) };
    return next();
  } catch {
    return next(new Error('INVALID_TOKEN'));
  }
});
const WATCH_ROOM_TTL_MS = Math.max(5 * 60_000, Number(process.env.WATCH_ROOM_TTL_MS) || 30 * 60_000);
const WATCH_ROOM_MAX_USERS = Math.min(50, Math.max(2, Number(process.env.WATCH_ROOM_MAX_USERS) || 20));
type WatchRoom = { slug: string; episode: number; hostId: string; hostUserId: string; state: { playing: boolean; currentTime: number; updatedAt: number }; users: Map<string, string>; userIds: Map<string, string>; isPrivate: boolean; passwordHash: string | null; accessKey: string; createdAt: number; expiresAt: number };
const watchRooms = new Map<string, WatchRoom>();
const hostTransferTimers = new Map<string, NodeJS.Timeout>();
const getUsers = (room: WatchRoom) => [...room.users.entries()].map(([id, name]) => ({ id, name }));
const roomSnapshot = (room: WatchRoom) => ({ users: getUsers(room), hostId: room.hostId, episode: room.episode, isPrivate: room.isPrivate });
const publicRoomList = () => [...watchRooms.entries()]
  .filter(([, room]) => room.users.size > 0)
  .map(([id, room]) => ({
    id,
    slug: room.slug,
    episode: room.episode,
    hostName: room.users.get(room.hostId) || 'Chủ phòng',
    viewerCount: room.users.size,
    playing: room.state.playing,
    isPrivate: room.isPrivate,
    createdAt: room.createdAt,
  }))
  .sort((first, second) => second.createdAt - first.createdAt);
const broadcastPublicRooms = () => io.emit('rooms:update', publicRoomList());
const cleanName = (name: unknown, fallback: string) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 30) : fallback;
const touchRoom = (room: WatchRoom) => { room.expiresAt = Date.now() + WATCH_ROOM_TTL_MS; };
const roomPasswordHash = (password: string) => crypto.createHash('sha256').update(password).digest('hex');
const persistRoom = (roomId: string, room: WatchRoom) => cacheSet(`cine3d:watch-room:${roomId}`, {
  slug: room.slug, episode: room.episode, hostId: room.hostId, hostUserId: room.hostUserId, state: room.state,
  users: [...room.users.entries()], userIds: [...room.userIds.entries()], isPrivate: room.isPrivate, passwordHash: room.passwordHash, accessKey: room.accessKey,
  createdAt: room.createdAt, expiresAt: room.expiresAt,
}, Math.max(1_000, room.expiresAt - Date.now()));
const persistKnownRoom = (room: WatchRoom) => {
  const entry = [...watchRooms.entries()].find(([, candidate]) => candidate === room);
  if (entry) void persistRoom(entry[0], room);
};
const clearHostTransfer = (roomId: string) => {
  const timer = hostTransferTimers.get(roomId);
  if (timer) clearTimeout(timer);
  hostTransferTimers.delete(roomId);
};
const scheduleHostTransfer = (roomId: string, room: WatchRoom) => {
  clearHostTransfer(roomId);
  const timer = setTimeout(() => {
    hostTransferTimers.delete(roomId);
    if (room.users.has(room.hostId)) return;
    const nextHostId = room.users.keys().next().value as string | undefined;
    room.hostId = nextHostId || '';
    room.hostUserId = nextHostId ? room.userIds.get(nextHostId) || '' : '';
    persistKnownRoom(room);
    if (room.users.size) io.to(roomId).emit('room:users', roomSnapshot(room));
    broadcastPublicRooms();
  }, 8_000);
  timer.unref();
  hostTransferTimers.set(roomId, timer);
};

function takeRateSlot(socket: Socket, key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  const previous = Array.isArray(socket.data[key]) ? socket.data[key] as number[] : [];
  const recent = previous.filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= maximum) return false;
  recent.push(now); socket.data[key] = recent;
  return true;
}

function leaveWatchRoom(socket: Socket) {
  const roomId = socket.data.roomId as string | undefined;
  const room = roomId ? watchRooms.get(roomId) : undefined;
  delete socket.data.roomId;
  if (!roomId || !room) return;
  socket.leave(roomId);
  const wasHost = room.hostId === socket.id;
  room.users.delete(socket.id);
  room.userIds.delete(socket.id);
  if (wasHost) scheduleHostTransfer(roomId, room);
  touchRoom(room);
  persistKnownRoom(room);
  if (room.users.size) io.to(roomId).emit('room:users', roomSnapshot(room));
  broadcastPublicRooms();
}

io.on('connection', (socket) => {
  socket.on('rooms:list', (callback?: (rooms: ReturnType<typeof publicRoomList>) => void) => callback?.(publicRoomList()));
  socket.on('room:create', ({ slug, episode, name, privateRoom, password }, callback) => {
    if (typeof slug !== 'string' || !slug.trim()) return callback({ error: 'Thông tin phim không hợp lệ.' });
    const isPrivate = Boolean(privateRoom);
    if (isPrivate && !socket.data.user?.canAccessVip) return callback({ error: 'Chỉ thành viên VIP mới được tạo phòng riêng tư.' });
    if (isPrivate && (typeof password !== 'string' || password.length < 4 || password.length > 50)) return callback({ error: 'Mật khẩu phòng phải từ 4 đến 50 ký tự.' });
    leaveWatchRoom(socket);
    const roomId = crypto.randomBytes(4).toString('hex');
    const room: WatchRoom = { slug: slug.trim(), episode: Math.max(1, Number(episode) || 1), hostId: socket.id, hostUserId: socket.data.user.id, state: { playing: false, currentTime: 0, updatedAt: Date.now() }, users: new Map([[socket.id, cleanName(name, 'Chủ phòng')]]), userIds: new Map([[socket.id, socket.data.user.id]]), isPrivate, passwordHash: isPrivate ? roomPasswordHash(password) : null, accessKey: crypto.randomBytes(24).toString('base64url'), createdAt: Date.now(), expiresAt: Date.now() + WATCH_ROOM_TTL_MS };
    watchRooms.set(roomId, room); void persistRoom(roomId, room); socket.join(roomId); socket.data.roomId = roomId;
    const roomAccessToken = isPrivate ? issueRoomAccessToken({ roomId, userId: socket.data.user.id, accessKey: room.accessKey, expiresAt: room.expiresAt }) : undefined;
    callback({ roomId, slug: room.slug, state: room.state, roomAccessToken, ...roomSnapshot(room) });
    broadcastPublicRooms();
  });
  socket.on('room:join', ({ roomId, name, password, roomAccessToken }, callback) => {
    if (typeof roomId !== 'string' || !roomId) return callback({ error: 'Mã phòng không hợp lệ.' });
    const room = watchRooms.get(roomId);
    if (!room) return callback({ error: 'Phòng không tồn tại hoặc đã đóng.' });
    const tokenValid = room.isPrivate && verifyRoomAccessToken(roomAccessToken, { roomId, userId: socket.data.user.id, accessKey: room.accessKey });
    if (room.isPrivate && !tokenValid && room.passwordHash !== roomPasswordHash(typeof password === 'string' ? password : '')) return callback({ error: 'Mật khẩu phòng không đúng.', passwordRequired: true });
    if (!room.users.has(socket.id) && room.users.size >= WATCH_ROOM_MAX_USERS) return callback({ error: `Phòng đã đủ ${WATCH_ROOM_MAX_USERS} người.` });
    leaveWatchRoom(socket);
    room.users.set(socket.id, cleanName(name, 'Khách')); room.userIds.set(socket.id, socket.data.user.id); socket.join(roomId); socket.data.roomId = roomId;
    if (room.hostUserId === socket.data.user.id) { room.hostId = socket.id; clearHostTransfer(roomId); }
    else if (!room.hostId && !room.hostUserId) { room.hostId = socket.id; room.hostUserId = socket.data.user.id; }
    touchRoom(room);
    persistKnownRoom(room);
    io.to(roomId).emit('room:users', roomSnapshot(room));
    const nextRoomAccessToken = room.isPrivate ? issueRoomAccessToken({ roomId, userId: socket.data.user.id, accessKey: room.accessKey, expiresAt: room.expiresAt }) : undefined;
    callback({ roomId, slug: room.slug, state: room.state, roomAccessToken: nextRoomAccessToken, ...roomSnapshot(room) });
    broadcastPublicRooms();
  });
  socket.on('room:control', (payload: { type: 'play' | 'pause' | 'seek'; currentTime: number }) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room || room.hostId !== socket.id || !['play', 'pause', 'seek'].includes(payload?.type) || !Number.isFinite(payload?.currentTime) || !takeRateSlot(socket, 'controlEvents', 30, 5_000)) return;
    const previousPlaying = room.state.playing;
    const playing = payload.type === 'seek' ? previousPlaying : payload.type === 'play';
    room.state = { playing, currentTime: Math.min(24 * 60 * 60, Math.max(0, payload.currentTime)), updatedAt: Date.now() };
    touchRoom(room); persistKnownRoom(room); io.to(roomId).emit('room:state', room.state);
    if (previousPlaying !== playing) broadcastPublicRooms();
  });
  socket.on('room:message', (message: string) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (roomId && room && typeof message === 'string' && message.trim() && takeRateSlot(socket, 'messageEvents', 6, 10_000)) {
      touchRoom(room); persistKnownRoom(room); io.to(roomId).emit('room:message', { name: room.users.get(socket.id) || 'Khách', message: message.trim().slice(0, 300) });
    }
  });
  socket.on('room:reaction', (emoji: string) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    const allowed = new Set(['❤️', '😂', '😮', '👏', '🔥', '😢']);
    if (!roomId || !room || !allowed.has(emoji) || !takeRateSlot(socket, 'reactionEvents', 5, 5_000)) return;
    touchRoom(room); persistKnownRoom(room);
    io.to(roomId).emit('room:reaction', { id: crypto.randomBytes(6).toString('hex'), emoji, name: room.users.get(socket.id) || 'Khách', createdAt: Date.now() });
  });
  socket.on('room:episode', (episode: number, callback?: (result: { ok?: boolean; error?: string }) => void) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room || room.hostId !== socket.id) return callback?.({ error: 'Chỉ chủ phòng mới được đổi tập.' });
    const nextEpisode = Math.max(1, Math.floor(Number(episode)));
    if (!Number.isFinite(nextEpisode)) return callback?.({ error: 'Tập phim không hợp lệ.' });
    room.episode = nextEpisode;
    room.state = { playing: false, currentTime: 0, updatedAt: Date.now() };
    touchRoom(room);
    persistKnownRoom(room);
    io.to(roomId).emit('room:episode', { episode: room.episode, state: room.state });
    broadcastPublicRooms();
    callback?.({ ok: true });
  });
  socket.on('room:kick', (targetId: string, callback?: (result: { ok?: boolean; error?: string }) => void) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room || room.hostId !== socket.id) return callback?.({ error: 'Chỉ chủ phòng mới được mời thành viên ra.' });
    if (!targetId || targetId === socket.id || !room.users.has(targetId)) return callback?.({ error: 'Thành viên không hợp lệ.' });
    const target = io.sockets.sockets.get(targetId);
    room.users.delete(targetId);
    room.userIds.delete(targetId);
    persistKnownRoom(room);
    if (target) {
      target.emit('room:kicked', { message: 'Bạn đã được chủ phòng mời ra.' });
      target.leave(roomId);
      delete target.data.roomId;
    }
    io.to(roomId).emit('room:users', roomSnapshot(room));
    broadcastPublicRooms();
    callback?.({ ok: true });
  });
  socket.on('room:leave', () => leaveWatchRoom(socket));
  socket.on('room:close', (callback?: (result: { ok?: boolean; error?: string }) => void) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room || room.hostId !== socket.id) return callback?.({ error: 'Chỉ chủ phòng mới có thể đóng phòng.' });
    io.to(roomId).emit('room:closed', { message: 'Chủ phòng đã đóng phòng.' });
    io.in(roomId).socketsLeave(roomId); watchRooms.delete(roomId); clearHostTransfer(roomId); void cacheDelete(`cine3d:watch-room:${roomId}`); delete socket.data.roomId;
    broadcastPublicRooms();
    callback?.({ ok: true });
  });
  socket.on('disconnect', () => leaveWatchRoom(socket));
});

const watchRoomCleanup = setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [roomId, room] of watchRooms) {
    if (room.users.size === 0 && room.expiresAt <= now) { watchRooms.delete(roomId); clearHostTransfer(roomId); void cacheDelete(`cine3d:watch-room:${roomId}`); changed = true; }
  }
  if (changed) broadcastPublicRooms();
}, 60_000);
watchRoomCleanup.unref();

const analyticsCleanup = setInterval(() => {
  const retentionDays = Math.max(7, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  void prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch((error) => console.warn('Analytics retention cleanup failed.', error));
}, 6 * 60 * 60 * 1000);
analyticsCleanup.unref();

const notifyReleasedEpisodes = async () => {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dueEpisodes = await prisma.episode.findMany({
    where: { airDate: { gte: recentCutoff, lte: now }, releaseNotifiedAt: null },
    take: 20,
    orderBy: { airDate: 'asc' },
    include: { movie: { select: { id: true, title: true, slug: true, followers: { select: { userId: true } } } } },
  });
  for (const episode of dueEpisodes) {
    const claimed = await prisma.episode.updateMany({ where: { id: episode.id, releaseNotifiedAt: null }, data: { releaseNotifiedAt: now } });
    if (!claimed.count || !episode.movie.followers.length) continue;
    const userIds = episode.movie.followers.map((follow) => follow.userId);
    const notification = { title: `${episode.movie.title} có tập mới`, message: `${episode.title} đã đến giờ phát hành. Xem ngay trên CINE3D.`, url: `/watch/${episode.movie.slug}?ep=${episode.episodeOrder}` };
    await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...notification })) });
    void sendPushToUsers(userIds, { title: notification.title, body: notification.message, url: notification.url });
  }
};

void notifyReleasedEpisodes().catch((error) => console.warn('Release notification check failed.', error));
const releaseNotificationTimer = setInterval(() => {
  void notifyReleasedEpisodes().catch((error) => console.warn('Release notification check failed.', error));
}, 60_000);
releaseNotificationTimer.unref();

const sourceHealthTimer = setInterval(() => {
  void checkDueVideoSources(20).catch((error) => console.warn('Video source health check failed.', error));
}, 30 * 60_000);
sourceHealthTimer.unref();

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  3D Movie Streaming Backend is running!     `);
  console.log(`  Port: ${PORT}                               `);
  console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  clearInterval(watchRoomCleanup);
  clearInterval(analyticsCleanup);
  clearInterval(releaseNotificationTimer);
  clearInterval(sourceHealthTimer);
  for (const timer of hostTransferTimers.values()) clearTimeout(timer);
  hostTransferTimers.clear();
  server.close(async () => {
    io.close();
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
