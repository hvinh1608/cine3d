import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 5000;
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

// API Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' ? { error: err.message } : {}),
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  3D Movie Streaming Backend is running!     `);
  console.log(`  Port: ${PORT}                               `);
  console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});
