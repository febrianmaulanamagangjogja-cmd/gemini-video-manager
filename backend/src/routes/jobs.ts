import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../database/db.js';
import { z } from 'zod';
import { config } from '../config/index.js';
import { uploadVideo } from '../middleware/upload.js';

const router = Router();

const jobSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required'),
  reference_image_path: z.string().max(500).optional().nullable(),
  aspect_ratio: z.enum(['9:16', '16:9']).default('9:16'),
  account_id: z.number().int().min(0).optional().nullable(),
});

const jobUpdateSchema = z.object({
  prompt: z.string().min(1).optional(),
  reference_image_path: z.string().max(500).optional().nullable(),
  aspect_ratio: z.enum(['9:16', '16:9']).optional(),
  account_id: z.number().int().min(0).optional().nullable(),
  status: z.enum(['queued', 'preparing', 'running', 'downloading', 'completed', 'failed', 'paused', 'cancelled', 'awaiting_user']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  attempt_count: z.number().int().min(0).optional(),
  output_video_path: z.string().max(500).optional().nullable(),
  error_message: z.string().optional().nullable(),
  started_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
});

function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: Function) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

async function logJobEvent(
  jobId: number,
  event: string,
  message: string,
  level: 'info' | 'warning' | 'error' | 'debug' = 'info',
  accountId?: number
) {
  try {
    await pool.query(
      'INSERT INTO `job_logs` (`job_id`, `account_id`, `level`, `event`, `message`) VALUES (?, ?, ?, ?, ?)',
      [jobId, accountId || null, level, event, message]
    );
  } catch (err) {
    console.error('Failed to log job event:', err);
  }
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, account_id, limit = '50', offset = '0' } = req.query;
    const user = (req as any).user;
    
    let sql = 'SELECT * FROM `video_jobs` WHERE 1=1';
    const params: any[] = [];

    // Filter isolasi user
    if (user && user.role !== 'admin') {
      sql += ' AND `user_id` = ?';
      params.push(user.id);
    }

    if (status) {
      sql += ' AND `status` = ?';
      params.push(status);
    }
    if (account_id) {
      sql += ' AND `account_id` = ?';
      params.push(parseInt(account_id as string, 10));
    }

    sql += ' ORDER BY `created_at` DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch jobs', message: err.message });
  }
});

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, prompt, status, error_message, updated_at FROM `video_jobs` WHERE status IN ('awaiting_user', 'failed') ORDER BY `updated_at` DESC LIMIT 10"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', message: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const [rows] = await pool.query('SELECT * FROM `video_jobs` WHERE `id` = ?', [id]);
    const jobs = rows as any[];
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });

    const [assets] = await pool.query('SELECT * FROM `video_assets` WHERE `job_id` = ?', [id]);
    const [logs] = await pool.query('SELECT * FROM `job_logs` WHERE `job_id` = ? ORDER BY `created_at` ASC', [id]);

    res.json({ ...jobs[0], assets, logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch job', message: err.message });
  }
});

router.post('/', validate(jobSchema), async (req: Request, res: Response) => {
  try {
    const { prompt, reference_image_path = null, aspect_ratio = '9:16', account_id = null } = req.body;
    const user = (req as any).user;
    const userId = user ? user.id : null;

    const [result] = await pool.query(
      'INSERT INTO `video_jobs` (`prompt`, `reference_image_path`, `aspect_ratio`, `account_id`, `user_id`) VALUES (?, ?, ?, ?, ?)',
      [prompt, reference_image_path, aspect_ratio, account_id, userId]
    );
    const insertResult = result as any;
    const jobId = insertResult.insertId;

    await logJobEvent(jobId, 'created', 'Job created and queued', 'info', account_id || undefined);

    const [rows] = await pool.query('SELECT * FROM `video_jobs` WHERE `id` = ?', [jobId]);
    res.status(201).json((rows as any[])[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create job', message: err.message });
  }
});

router.patch('/:id', validate(jobUpdateSchema), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const [oldRows] = await pool.query('SELECT * FROM `video_jobs` WHERE `id` = ?', [id]);
    const oldJobs = oldRows as any[];
    if (oldJobs.length === 0) return res.status(404).json({ error: 'Job not found' });
    const oldJob = oldJobs[0];

    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined) {
        updates.push('`' + key + '` = ?');
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (req.body.status && req.body.status !== oldJob.status) {
      await logJobEvent(
        id,
        'status_change',
        `Status changed from ${oldJob.status} to ${req.body.status}`,
        'info',
        oldJob.account_id || undefined
      );
    }

    if (req.body.error_message && req.body.error_message !== oldJob.error_message) {
      await logJobEvent(
        id,
        'error',
        req.body.error_message,
        'error',
        oldJob.account_id || undefined
      );
    }

    values.push(id);
    await pool.query('UPDATE `video_jobs` SET ' + updates.join(', ') + ' WHERE `id` = ?', values);

    const [rows] = await pool.query('SELECT * FROM `video_jobs` WHERE `id` = ?', [id]);
    res.json((rows as any[])[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update job', message: err.message });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid ID' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [jobRows] = await conn.query('SELECT * FROM video_jobs WHERE id = ? FOR UPDATE', [jobId]);
    const jobs = jobRows as any[];
    if (jobs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobs[0];
    const cancellableStatuses = ['queued', 'preparing', 'running', 'downloading', 'awaiting_user', 'paused'];
    
    if (!cancellableStatuses.includes(job.status)) {
      await conn.rollback();
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    // Sinyalkan pembatalan runtime sebelum mengubah status database.
    const { requestJobCancellation } = await import('../services/browserWorker.js');
    requestJobCancellation(jobId);

    // Update status to cancelled secara atomik setelah token runtime ditandai.
    await conn.query(
      'UPDATE video_jobs SET status = "cancelled", completed_at = NOW(), error_message = "Job cancelled by user request" WHERE id = ? AND status IN ("queued", "preparing", "running", "downloading", "awaiting_user", "paused")',
      [jobId]
    );

    const [cancelledRows] = await conn.query('SELECT status FROM video_jobs WHERE id = ?', [jobId]);
    if ((cancelledRows as any[])[0]?.status !== 'cancelled') {
      await conn.rollback();
      return res.status(409).json({ error: 'Job berubah sebelum pembatalan selesai' });
    }

    // Log the cancellation event
    await conn.query(
      'INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, ?, ?, ?)',
      [jobId, job.account_id, 'warn', 'job_cancelled', 'Job was explicitly cancelled by user request.']
    );

    // Release profile if assigned and job was not actively processed by worker loop.
    // Jika job sedang running, preparing, atau downloading, worker akan melepaskan lock
    // secara aman di dalam blok finally segera setelah operasi aktif berhenti.
    if (job.account_id && !['running', 'preparing', 'downloading'].includes(job.status)) {
      const { browserProfileManager } = await import('../services/browserProfileManager.js');
      await browserProfileManager.releaseProfileForJob(job.account_id);
    }

    await conn.commit();
    res.json({ success: true, message: `Job #${jobId} successfully cancelled.` });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to cancel job', message: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    // Check if job is in an active status
    const [jobRows] = await pool.query('SELECT status FROM `video_jobs` WHERE `id` = ?', [id]);
    const jobs = jobRows as any[];
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });

    const activeStatuses = ['queued', 'preparing', 'running', 'downloading', 'awaiting_user'];
    if (activeStatuses.includes(jobs[0].status)) {
      return res.status(409).json({ error: 'Cannot delete job with active status', message: 'Job is currently being processed. Please cancel or complete it first.' });
    }

    // Cascade delete related assets and logs first
    await pool.query('DELETE FROM `video_assets` WHERE `job_id` = ?', [id]);
    await pool.query('DELETE FROM `job_logs` WHERE `job_id` = ?', [id]);

    const [result] = await pool.query('DELETE FROM `video_jobs` WHERE `id` = ?', [id]);
    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete job', message: err.message });
  }
});

router.get('/stats/notifications', async (req: Request, res: Response) => {
  try {
    const [statsRows] = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'awaiting_user' THEN 1 ELSE 0 END) as awaiting_user,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' OR status = 'queued' OR status = 'preparing' OR status = 'downloading' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        COUNT(*) as total
      FROM \`video_jobs\`
    `);
    const stats = (statsRows as any[])[0];
    res.json({
      awaiting_user: stats.awaiting_user || 0,
      failed: stats.failed || 0,
      running: stats.running || 0,
      queued: stats.queued || 0,
      total: stats.total || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notification stats', message: err.message });
  }
});

router.post('/:id/upload', (req: Request, res: Response, next: Function) => {
  uploadVideo.single('video')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: 'Validation failed', message: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid ID' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 1. Update job to completed
    await conn.query(
      'UPDATE video_jobs SET status = "completed", progress = 100, output_video_path = ?, completed_at = NOW(), error_message = NULL WHERE id = ?',
      [req.file.path, jobId]
    );
    // 2. Insert to video_assets
    const [assetResult] = await conn.query(
      'INSERT INTO video_assets (job_id, asset_type, file_path, mime_type, file_size) VALUES (?, ?, ?, ?, ?)',
      [jobId, 'output_video', req.file.path, req.file.mimetype, req.file.size]
    );
    const assetId = (assetResult as any).insertId;

    // 3. Log (using transaction connection)
    await conn.query(
      'INSERT INTO `job_logs` (`job_id`, `account_id`, `level`, `event`, `message`) VALUES (?, ?, ?, ?, ?)',
      [jobId, null, 'info', 'video_uploaded', `Video uploaded: ${req.file.filename}`]
    );
    await conn.query(
      'INSERT INTO `job_logs` (`job_id`, `account_id`, `level`, `event`, `message`) VALUES (?, ?, ?, ?, ?)',
      [jobId, null, 'info', 'job_completed', 'Job marked as completed after video upload']
    );
    
    await conn.commit();
    res.json({ success: true, message: 'Upload successful', assetId, path: req.file.path });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: 'Upload failed', message: err.message });
  } finally {
    conn.release();
  }
});

router.get('/:id/download', async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const [jobRows] = await pool.query('SELECT * FROM video_jobs WHERE id = ?', [jobId]);
    const jobs = jobRows as any[];
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });

    const job = jobs[0];
    const videoPath = job.output_video_path;

    if (!videoPath) {
      return res.status(404).json({ error: 'No video available for this job' });
    }

    // Resolve absolute path from storage directory
    const storageBase = path.resolve(process.cwd(), config.storagePath || '../storage');
    let absolutePath: string;

    if (path.isAbsolute(videoPath)) {
      absolutePath = videoPath;
    } else {
      // Normalize relative path: strip leading 'storage/' or 'outputs/' prefix
      let relativePath = videoPath.replace(/^storage[\\/]/, '').replace(/^outputs[\\/]/, '');
      absolutePath = path.resolve(storageBase, 'outputs', relativePath);
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    const stat = fs.statSync(absolutePath);
    const filename = path.basename(absolutePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(absolutePath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: 'Download failed', message: err.message });
  }
});

router.post('/:id/open-folder', async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const [jobRows] = await pool.query('SELECT output_video_path FROM video_jobs WHERE id = ?', [jobId]);
    const jobs = jobRows as any[];
    if (jobs.length === 0 || !jobs[0].output_video_path) {
      return res.status(404).json({ error: 'Video not found for this job' });
    }

    const videoPath = jobs[0].output_video_path;
    const storageBase = path.resolve(process.cwd(), config.storagePath || '../storage');
    let absolutePath: string;

    if (path.isAbsolute(videoPath)) {
      absolutePath = videoPath;
    } else {
      let relativePath = videoPath.replace(/^storage[\\/]/, '').replace(/^outputs[\\/]/, '');
      absolutePath = path.resolve(storageBase, 'outputs', relativePath);
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Video file does not exist on disk' });
    }

    // Open folder / file explorer based on platform
    const { spawn } = await import('node:child_process');
    if (process.platform === 'win32') {
      spawn('explorer.exe', ['/select,', absolutePath]);
    } else if (process.platform === 'darwin') {
      spawn('open', ['-R', absolutePath]);
    } else {
      // Linux or other Unix systems: open parent directory or usexdg-open
      const dirPath = path.dirname(absolutePath);
      spawn('xdg-open', [dirPath]);
    }

    res.json({ success: true, message: 'Opening folder...' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to open folder', message: err.message });
  }
});

export default router;