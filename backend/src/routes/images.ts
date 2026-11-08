import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

const router = Router();

router.get('/:id/reference-image', async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const [jobRows] = await pool.query('SELECT reference_image_path FROM video_jobs WHERE id = ?', [jobId]);
    const jobs = jobRows as any[];
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });

    const imagePath = jobs[0].reference_image_path;
    if (!imagePath) return res.status(404).json({ error: 'No reference image available' });

    const storageBase = path.resolve(process.cwd(), config.storagePath || '../storage');
    let absolutePath: string;

    if (path.isAbsolute(imagePath)) {
      absolutePath = imagePath;
    } else {
      let relativePath = imagePath.replace(/^storage[\\/]/, '');
      absolutePath = path.resolve(storageBase, relativePath);
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    return fs.createReadStream(absolutePath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to serve reference image', message: err.message });
  }
});

export default router;