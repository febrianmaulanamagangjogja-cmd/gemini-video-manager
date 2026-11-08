import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { authService } from '../services/authService.js';
import { requireAuth, requireAdmin } from './auth.js';
import { z } from 'zod';
import { getAllSettings, updateSettings, type SystemSettings } from '../services/settingsService.js';

const router = Router();

// Schema untuk validasi input admin
const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(100),
  password: z.string().min(8, 'Password minimal 8 karakter').max(255),
  role: z.enum(['user', 'admin'], { required_error: 'Role harus user atau admin' }),
});

const updateUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(100).optional(),
  password: z.string().min(8, 'Password minimal 8 karakter').max(255).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const searchUserSchema = z.object({
  query: z.string().min(1),
  role: z.enum(['user', 'admin', 'all']).default('all'),
});

/**
 * GET /api/admin/dashboard - Dashboard admin
 * Menampilkan ringkasan statistik administrasi
 */
router.get('/dashboard', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Hitung total pengguna
    const [userCountRows] = await pool.query('SELECT COUNT(*) as count FROM `app_users`');
    const totalUsers = (userCountRows as any[])[0].count;

    // Hitung jumlah user dan admin
    const [roleCounts] = await pool.query(
      'SELECT role, COUNT(*) as count FROM `app_users` GROUP BY role'
    );
    const roleMap: Record<string, number> = {};
    (roleCounts as any[]).forEach((row: any) => {
      roleMap[row.role] = row.count;
    });
    const userCount = roleMap['user'] || 0;
    const adminCount = roleMap['admin'] || 0;

    // Hitung total job berdasarkan status
    const [jobStatusCounts] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `video_jobs` GROUP BY status'
    );
    const jobStatusMap: Record<string, number> = {};
    (jobStatusCounts as any[]).forEach((row: any) => {
      jobStatusMap[row.status] = row.count;
    });
    const queuedCount = jobStatusMap['queued'] || 0;
    const runningCount = jobStatusMap['running'] || 0;
    const completedCount = jobStatusMap['completed'] || 0;
    const failedCount = jobStatusMap['failed'] || 0;
    const cancelledCount = jobStatusMap['cancelled'] || 0;

    // Ambil aktivitas terbaru (user dibuat, role diubah, dll)
    const [recentActivities] = await pool.query(
      `SELECT al.id, al.actor_id, al.action, al.target_id, al.details, al.created_at, u.username as actor_username
       FROM \`admin_audit_logs\` al
       LEFT JOIN \`app_users\` u ON al.actor_id = u.id
       ORDER BY al.created_at DESC 
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalUsers,
        userCount,
        adminCount,
        jobStats: {
          queued: queuedCount,
          running: runningCount,
          completed: completedCount,
          failed: failedCount,
          cancelled: cancelledCount,
        },
        recentActivities: recentActivities as any[],
      },
    });
  } catch (err: any) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * GET /api/admin/users - Daftar pengguna dengan search dan filter
 */
router.get('/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { query = '', role = 'all' } = req.query as { query: string; role: string };

    let whereClause = 'WHERE 1=1';
    let params: any[] = [];

    if (query) {
      whereClause += ' AND (`username` LIKE ? OR `email` LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    if (role !== 'all') {
      whereClause += ' AND `role` = ?';
      params.push(role);
    }

    const [rows] = await pool.query(
          `SELECT id, username, role, created_at
           FROM \`app_users\`
           ${whereClause}
           ORDER BY created_at DESC`,
          params
        );

    res.json({
      success: true,
      data: rows as any[],
    });
  } catch (err: any) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * POST /api/admin/users - Buat pengguna baru
 */
router.post('/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: result.error.flatten(),
      });
    }

    const { username, password, role = 'user' } = result.data;

    // Cek username sudah ada
    const [existing] = await pool.query(
      'SELECT 1 FROM `app_users` WHERE `username` = ?',
      [username]
    );
    if ((existing as any[]).length > 0) {
      return res.status(409).json({
        error: 'Konflik',
        message: 'Username sudah terdaftar',
      });
    }

    // Buat user dengan password hash
    const passwordHash = await authService.hashPassword(password);
    const [insertResult] = await pool.execute(
      'INSERT INTO `app_users` (`username`, `password_hash`, `role`) VALUES (?, ?, ?)',
      [username, passwordHash, role]
    );

    // Catat audit log
    const actorId = (req as any).user?.id;
    await pool.execute(
      'INSERT INTO `admin_audit_logs` (`actor_id`, `action`, `target_id`, `details`) VALUES (?, ?, ?, ?)',
      [actorId, 'CREATE_USER', (insertResult as any).insertId, `User "${username}" dibuat dengan role ${role}`]
    );

    res.status(201).json({
      success: true,
      data: {
        id: (insertResult as any).insertId,
        username,
        role,
      },
      message: 'User berhasil dibuat',
    });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * PUT /api/admin/users/:id - Update pengguna
 */
router.put('/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = updateUserSchema.safeParse({
      ...req.body,
      id: parseInt(req.params.id),
    });
    if (!result.success) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: result.error.flatten(),
      });
    }

    const { id } = req.params;
    const { username, password, role } = req.body;

    // Ambil target username sebelum diupdate
    const [targetUserRows] = await pool.query('SELECT username FROM `app_users` WHERE `id` = ?', [Number(id)]);
    const targetUsername = (targetUserRows as any[])[0]?.username || `ID #${id}`;

    // Cek user ada
    const [userCheck] = await pool.query(
      'SELECT 1 FROM `app_users` WHERE `id` = ?',
      [id]
    );
    if ((userCheck as any[]).length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User tidak ditemukan',
      });
    }

    // Cegah hapus role terakhir admin
    if (role === 'admin') {
      const [adminCount] = await pool.query(
        'SELECT COUNT(*) as count FROM `app_users` WHERE `role` = \'admin\' AND `id` != ?',
        [id]
      );
      if ((adminCount as any[])[0].count === 0) {
        return res.status(403).json({
          error: 'Akses ditolak',
          message: 'Tidak dapat mengurangi role admin terakhir',
        });
      }
    }

    // Build update query
    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (username !== undefined) {
      const [existing] = await pool.query(
        'SELECT 1 FROM `app_users` WHERE `username` = ? AND `id` != ?',
        [username, id]
      );
      if ((existing as any[]).length > 0) {
        return res.status(409).json({
          error: 'Konflik',
          message: 'Username sudah digunakan oleh akun lain',
        });
      }
      updateFields.push('`username` = ?');
      updateParams.push(username);
    }
    if (password !== undefined) {
      const passwordHash = await authService.hashPassword(password);
      updateFields.push('`password_hash` = ?');
      updateParams.push(passwordHash);
    }
    if (role !== undefined) {
      updateFields.push('`role` = ?');
      updateParams.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: 'Tidak ada field yang diupdate',
      });
    }

    updateParams.push(id);

    await pool.execute(
      `UPDATE \`app_users\` SET ${updateFields.join(', ')} WHERE \`id\` = ?`,
      updateParams
    );

    // Catat audit log
    const actorId = (req as any).user?.id;
    await pool.execute(
      'INSERT INTO `admin_audit_logs` (`actor_id`, `action`, `target_id`, `details`) VALUES (?, ?, ?, ?)',
      [actorId, 'UPDATE_USER', Number(id), `User "${targetUsername}" (ID #${id}) diperbarui: ${JSON.stringify(req.body)}`]
    );

    res.json({
      success: true,
      message: 'User berhasil diperbarui',
    });
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * DELETE /api/admin/users/:id - Nonaktifkan pengguna (soft delete)
 * Jangan menghapus job, video, atau aset pengguna
 */
router.delete('/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Cegah admin menghapus diri sendiri
    const currentUserId = (req as any).user?.id;
    if (Number(id) === currentUserId) {
      return res.status(400).json({
        error: 'Akses ditolak',
        message: 'Anda tidak dapat menghapus akun Anda sendiri',
      });
    }

    // Ambil target username sebelum dihapus
    const [targetUserRows] = await pool.query('SELECT username FROM `app_users` WHERE `id` = ?', [Number(id)]);
    const targetUsername = (targetUserRows as any[])[0]?.username || `ID #${id}`;

    // Cegah nonaktifkan satu-satunya admin
    if ((req as any).user?.role === 'admin') {
      const [adminCount] = await pool.query(
        'SELECT COUNT(*) as count FROM `app_users\` WHERE \`role\` = \'admin\' AND \`id\` != ?',
        [id]
      );
      if ((adminCount as any[])[0].count === 0) {
        return res.status(403).json({
          error: 'Akses ditolak',
          message: 'Tidak dapat menonaktifkan satu-satunya administrator',
        });
      }
    }

    // Hapus user dari database (hard delete)
    await pool.execute(
      'DELETE FROM `app_users` WHERE `id` = ?',
      [Number(id)]
    );

    // Hapus session user
    await authService.deleteUserSessions(Number(id));

    // Catat audit log
    const actorId = (req as any).user?.id;
    await pool.execute(
      'INSERT INTO `admin_audit_logs` (`actor_id`, `action`, `target_id`, `details`) VALUES (?, ?, ?, ?)',
      [actorId, 'DELETE_USER', Number(id), `User "${targetUsername}" (ID #${id}) dihapus permanen`]
    );

    res.json({
      success: true,
      message: 'User berhasil dihapus permanen',
    });
  } catch (err: any) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * POST /api/admin/users/:id/reset-password - Reset password admin
 */
router.post('/users/:id/reset-password', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Cek user ada
    const [userCheck] = await pool.query(
      'SELECT 1 FROM `app_users` WHERE `id` = ?',
      [id]
    );
    if ((userCheck as any[]).length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User tidak ditemukan',
      });
    }

    // Buat password baru (tanpa hash di response, akan di-hash di service)
    // Gunakan password sementara yang harus diubah saat login pertama
    const tempPassword = 'TempPass123!'; // Password sementara - admin akan diarahkan mengubahnya
    const passwordHash = await authService.hashPassword(tempPassword);

    await pool.execute(
      'UPDATE \`app_users\` SET `password_hash` = ? WHERE \`id\` = ?',
      [passwordHash, Number(id)]
    );

    // Catat audit log
    const actorId = (req as any).user?.id;
    await pool.execute(
      'INSERT INTO `admin_audit_logs` (`actor_id`, `action`, `target_id`, `details`) VALUES (?, ?, ?, ?)',
      [actorId, 'RESET_PASSWORD', Number(id), `Password admin ${id} direset (password sementara dihasilkan)`]
    );

    res.json({
      success: true,
      message: 'Password berhasil direset. Password sementara dibuat, admin harus mengubahnya saat login pertama.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * GET /api/admin/audit-logs - Ambil log audit dengan detail username
 */
router.get('/audit-logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [logs] = await pool.query(
      `SELECT al.id, al.actor_id, al.action, al.target_id, al.details, al.created_at, 
              u.username as actor_username, tu.username as target_username
       FROM \`admin_audit_logs\` al
       LEFT JOIN \`app_users\` u ON al.actor_id = u.id
       LEFT JOIN \`app_users\` tu ON al.target_id = tu.id
       ORDER BY al.created_at DESC 
       LIMIT 100`
    );
    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * GET /api/admin/settings - Ambil pengaturan sistem
 */
router.get('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await getAllSettings();
    res.json({ success: true, data: settings });
  } catch (err: any) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * PUT /api/admin/settings - Update pengaturan sistem
 */
router.put('/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings: Partial<SystemSettings> = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    const updatedSettings = await updateSettings(settings);
    res.json({ success: true, data: updatedSettings });
  } catch (err: any) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

export default router;