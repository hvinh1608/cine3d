import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketServer } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import apiRouter from './routes/api';
import { prisma } from './lib/prisma';

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
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin are server-to-server/health checks.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static Files Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'connected', timestamp: new Date() });
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
type WatchRoom = { slug: string; episode: number; hostId: string; state: { playing: boolean; currentTime: number; updatedAt: number }; users: Map<string, string>; expiresAt: number };
const watchRooms = new Map<string, WatchRoom>();
const getUsers = (room: WatchRoom) => [...room.users.entries()].map(([id, name]) => ({ id, name }));
const roomSnapshot = (room: WatchRoom) => ({ users: getUsers(room), hostId: room.hostId });

io.on('connection', (socket) => {
  socket.on('room:create', ({ slug, episode, name }, callback) => {
    if (typeof slug !== 'string' || !slug) return callback({ error: 'Thông tin phim không hợp lệ.' });
    const roomId = crypto.randomBytes(4).toString('hex');
    const room: WatchRoom = { slug, episode: Number(episode) || 1, hostId: socket.id, state: { playing: false, currentTime: 0, updatedAt: Date.now() }, users: new Map([[socket.id, name?.trim() || 'Chủ phòng']]), expiresAt: Date.now() + 30 * 60 * 1000 };
    watchRooms.set(roomId, room); socket.join(roomId); socket.data.roomId = roomId;
    callback({ roomId, slug: room.slug, episode: room.episode, state: room.state, ...roomSnapshot(room) });
  });
  socket.on('room:join', ({ roomId, name }, callback) => {
    const room = watchRooms.get(roomId);
    if (!room) return callback({ error: 'Phòng không tồn tại hoặc đã đóng.' });
    if (room.expiresAt < Date.now()) { watchRooms.delete(roomId); return callback({ error: 'Phòng đã hết hạn. Hãy tạo phòng mới.' }); }
    room.users.set(socket.id, name?.trim() || 'Khách'); socket.join(roomId); socket.data.roomId = roomId;
    if (!room.hostId || !room.users.has(room.hostId)) room.hostId = socket.id;
    room.expiresAt = Date.now() + 30 * 60 * 1000;
    io.to(roomId).emit('room:users', roomSnapshot(room));
    callback({ roomId, slug: room.slug, episode: room.episode, state: room.state, ...roomSnapshot(room) });
  });
  socket.on('room:control', (payload: { type: 'play' | 'pause' | 'seek'; currentTime: number }) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room || room.hostId !== socket.id || !Number.isFinite(payload?.currentTime)) return;
    const playing = payload.type === 'seek' ? room.state.playing : payload.type === 'play';
    room.state = { playing, currentTime: Math.max(0, payload.currentTime), updatedAt: Date.now() };
    io.to(roomId!).emit('room:state', room.state);
  });
  socket.on('room:message', (message: string) => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (roomId && room && typeof message === 'string' && message.trim()) io.to(roomId).emit('room:message', { name: room.users.get(socket.id) || 'Khách', message: message.trim().slice(0, 300) });
  });
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId as string | undefined; const room = roomId ? watchRooms.get(roomId) : undefined;
    if (!roomId || !room) return;
    room.users.delete(socket.id);
    if (room.hostId === socket.id) room.hostId = room.users.keys().next().value || '';
    room.expiresAt = Date.now() + 30 * 60 * 1000;
    if (room.users.size) io.to(roomId).emit('room:users', roomSnapshot(room));
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  3D Movie Streaming Backend is running!     `);
  console.log(`  Port: ${PORT}                               `);
  console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    io.close();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
