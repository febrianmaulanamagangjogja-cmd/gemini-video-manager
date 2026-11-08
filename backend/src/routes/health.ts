import { Router, Request, Response } from 'express';
import { testConnection } from '../database/db.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbStatus = await testConnection();
  const uptime = process.uptime();

  const responsePayload = {
    status: dbStatus.success ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    services: {
      server: 'healthy',
      database: dbStatus.success ? 'connected' : 'disconnected',
    },
  };

  const statusCode = dbStatus.success ? 200 : 503;
  res.status(statusCode).json(responsePayload);
});

export default router;