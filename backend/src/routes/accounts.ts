import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { z } from 'zod';
import { browserProfileManager } from '../services/browserProfileManager.js';
import path from 'path';

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  profile_path: z.string().min(1, 'Profile path is required').max(500, 'Profile path too long'),
  status: z.enum(['unconfigured', 'available', 'busy', 'limited', 'cooldown', 'error', 'disabled']).optional(),
});

const accountUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  profile_path: z.string().min(1).max(500).optional(),
  status: z.enum(['unconfigured', 'available', 'busy', 'limited', 'cooldown', 'error', 'disabled']).optional(),
  completed_job_count: z.number().int().min(0).optional(),
  total_job_count: z.number().int().min(0).optional(),
  last_used_at: z.string().datetime().optional().nullable(),
  cooldown_until: z.string().datetime().optional().nullable(),
  last_error: z.string().optional().nullable(),
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

// Sinkronisasi data pekerjaan ke dalam profil akun
export async function syncAccountJobCounts() {
  try {
    await pool.execute(`
      UPDATE gemini_accounts acc
      JOIN (
        SELECT account_id, 
               COUNT(*) as total, 
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed 
        FROM video_jobs 
        WHERE account_id IS NOT NULL 
        GROUP BY account_id
      ) jobs ON acc.id = jobs.account_id
      SET acc.total_job_count = jobs.total,
          acc.completed_job_count = jobs.completed
    `);
  } catch (err) {
    console.error('[AccountService] Failed to sync account job counts:', err);
  }
}

// GET /api/accounts
router.get('/', async (req: Request, res: Response) => {
  try {
    // Jalankan sinkronisasi sebelum mengambil data agar 0/0 terupdate otomatis
    await syncAccountJobCounts();

    const user = (req as any).user;
    let sql = 'SELECT * FROM `gemini_accounts`';
    const params: any[] = [];

    // Filter isolasi user: jika bukan admin atau jika req.query.all !== 'true'
    if (user) {
      if (user.role !== 'admin' || req.query.all !== 'true') {
        sql += ' WHERE `user_id` = ?';
        params.push(user.id);
      }
    }

    sql += ' ORDER BY `created_at` DESC';
    const [rows] = await pool.query(sql, params);
    const [activeJobRows] = await pool.query(
      "SELECT id, account_id, status FROM video_jobs WHERE status IN ('preparing', 'running', 'downloading', 'awaiting_user', 'paused')"
    );
    const activeJobsMap = new Map<number, { id: number; status: string }>();
    for (const job of activeJobRows as any[]) {
      if (job.account_id) {
        activeJobsMap.set(job.account_id, { id: job.id, status: job.status });
      }
    }

    const accounts = (rows as any[]).map(acc => {
      const isRunning = browserProfileManager.isProfileRunning(acc.id);
      const runtimeInUse = browserProfileManager.isProfileInUse(acc.id);
      const activeJob = activeJobsMap.get(acc.id) || (runtimeInUse ? { id: browserProfileManager.getActiveJobId(acc.id) || 0, status: 'running' } : null);
      const isBusy = runtimeInUse || !!activeJob;
      return {
        ...acc,
        is_running: isRunning,
        is_busy: isBusy,
        active_job_id: activeJob && activeJob.id ? activeJob.id : null,
        active_job_status: activeJob ? activeJob.status : null,
      };
    });
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch accounts', message: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = (req as any).user;
    let sql = 'SELECT * FROM `gemini_accounts` WHERE `id` = ?';
    const params: any[] = [id];

    if (user && user.role !== 'admin') {
      sql += ' AND `user_id` = ?';
      params.push(user.id);
    }

    const [rows] = await pool.query(sql, params);
    const accounts = rows as any[];
    if (accounts.length === 0) return res.status(404).json({ error: 'Account not found' });

    const isRunning = browserProfileManager.isProfileRunning(id);
    const runtimeInUse = browserProfileManager.isProfileInUse(id);
    const [activeJobs] = await pool.query(
      "SELECT id, status FROM video_jobs WHERE account_id = ? AND status IN ('preparing', 'running', 'downloading', 'awaiting_user', 'paused') LIMIT 1",
      [id]
    );
    const activeJob = (activeJobs as any[])[0] || null;
    const isBusy = runtimeInUse || !!activeJob;

    const account = {
      ...accounts[0],
      is_running: isRunning,
      is_busy: isBusy,
      active_job_id: activeJob ? activeJob.id : (runtimeInUse ? browserProfileManager.getActiveJobId(id) : null),
      active_job_status: activeJob ? activeJob.status : (runtimeInUse ? 'running' : null),
    };

    res.json(account);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch account', message: err.message });
  }
});

router.post('/', validate(accountSchema), async (req: Request, res: Response) => {
  try {
    let { name, profile_path, status = 'unconfigured' } = req.body;
    const user = (req as any).user;
    const userId = user ? user.id : null;
    
    // Safety check for profile_path
    const baseDir = path.resolve(process.cwd(), '../browser-profiles');
    const resolvedPath = path.resolve(profile_path);
    if (!resolvedPath.startsWith(path.resolve(baseDir))) {
      profile_path = path.join(baseDir, name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }

    const [result] = await pool.query(
      'INSERT INTO `gemini_accounts` (`name`, `profile_path`, `status`, `user_id`) VALUES (?, ?, ?, ?)',
      [name, profile_path, status, userId]
    );
    const insertResult = result as any;
    const [rows] = await pool.query('SELECT * FROM `gemini_accounts` WHERE `id` = ?', [insertResult.insertId]);
    res.status(201).json((rows as any[])[0]);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Profile path already exists' });
    }
    res.status(500).json({ error: 'Failed to create account', message: err.message });
  }
});

// Browser control endpoints
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = (req as any).user;
    if (user && user.role !== 'admin') {
      const [ownerCheck] = await pool.query('SELECT id FROM `gemini_accounts` WHERE id = ? AND user_id = ?', [id, user.id]);
      if ((ownerCheck as any[]).length === 0) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
    }

    const result = await browserProfileManager.launchProfile(id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to launch browser', message: err.message });
  }
});

router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = (req as any).user;
    if (user && user.role !== 'admin') {
      const [ownerCheck] = await pool.query('SELECT id FROM `gemini_accounts` WHERE id = ? AND user_id = ?', [id, user.id]);
      if ((ownerCheck as any[]).length === 0) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
    }

    const force = req.body?.force === true;
    const result = await browserProfileManager.closeProfile(id, force);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to close browser', message: err.message });
  }
});

router.post('/:id/check-login', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = (req as any).user;
    if (user && user.role !== 'admin') {
      const [ownerCheck] = await pool.query('SELECT id FROM `gemini_accounts` WHERE id = ? AND user_id = ?', [id, user.id]);
      if ((ownerCheck as any[]).length === 0) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
    }

    const result = await browserProfileManager.checkLoginStatus(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check login status', message: err.message });
  }
});

router.patch('/:id', validate(accountUpdateSchema), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = (req as any).user;
    if (user && user.role !== 'admin') {
      const [ownerCheck] = await pool.query('SELECT id FROM `gemini_accounts` WHERE id = ? AND user_id = ?', [id, user.id]);
      if ((ownerCheck as any[]).length === 0) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
    }

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

    values.push(id);
    const [result] = await pool.query(
      'UPDATE `gemini_accounts` SET ' + updates.join(', ') + ' WHERE `id` = ?',
      values
    );

    const updateResult = result as any;
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const [rows] = await pool.query('SELECT * FROM `gemini_accounts` WHERE `id` = ?', [id]);
    res.json((rows as any[])[0]);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Profile path already exists' });
    }
    res.status(500).json({ error: 'Failed to update account', message: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    if (browserProfileManager.isProfileRunning(id)) {
      await browserProfileManager.closeProfile(id);
    }

    const [result] = await pool.query('DELETE FROM `gemini_accounts` WHERE `id` = ?', [id]);
    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete account', message: err.message });
  }
});

export default router;
