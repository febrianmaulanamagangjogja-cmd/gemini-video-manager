import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config/index.js';
import healthRouter from './routes/health.js';
import accountsRouter from './routes/accounts.js';
import jobsRouter from './routes/jobs.js';
import uploadRouter from './routes/upload.js';
import imagesRouter from './routes/images.js';
import settingsRouter from './routes/settings.js';
import authRouter, { requireAuth, requireAdmin } from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { profileRouter } from './routes/profile.js';

export const app = express();

app.use(cookieParser());
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static storage files (protected - requires auth)
app.use('/storage', requireAuth, express.static(path.resolve(process.cwd(), config.storagePath)));

app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/jobs', requireAuth, jobsRouter);
app.use('/api/upload', requireAuth, uploadRouter);
app.use('/api/images', requireAuth, imagesRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/admin', requireAuth, requireAdmin, adminRouter);
app.use('/api/profile', requireAuth, profileRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled internal error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
