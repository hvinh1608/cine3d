import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import apiRouter from './routes/api';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
const allowedOrigins = new Set([
  'http://localhost:3000',
  'https://cine3d.vercel.app',
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

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  3D Movie Streaming Backend is running!     `);
  console.log(`  Port: ${PORT}                               `);
  console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
