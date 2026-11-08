import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { requireAuth } from './auth.js';
import { authService } from '../services/authService.js';

const router = Router();

/**
 * GET /api/profile - Ambil data profil pengguna saat ini
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const [rows] = await pool.query(
      'SELECT `id`, `username`, `role`, `avatar_url`, `created_at` FROM `app_users` WHERE `id` = ?',
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json({
      success: true,
      user: users[0],
    });
  } catch (err: any) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * POST /api/profile/verify-password - Verifikasi apakah password saat ini cocok
 */
router.post('/verify-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ valid: false, message: 'Password wajib diisi' });
    }

    const [rows] = await pool.query(
      'SELECT `password_hash` FROM `app_users` WHERE `id` = ?',
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ valid: false, message: 'Pengguna tidak ditemukan' });
    }

    const isValid = await authService.verifyPassword(password, users[0].password_hash);
    return res.json({ valid: isValid });
  } catch (err: any) {
    console.error('Verify password error:', err);
    res.status(500).json({ valid: false, message: err.message });
  }
});

/**
 * PUT /api/profile - Perbarui profil pengguna (username, avatar_url, password)
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { username, avatar_url, currentPassword, newPassword } = req.body;

    const [userRows] = await pool.query('SELECT * FROM `app_users` WHERE `id` = ?', [userId]);
    const users = userRows as any[];
    if (users.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const currentUser = users[0];

    const updates: string[] = [];
    const params: any[] = [];

    // Update username jika diisi
    if (username && username.trim() !== currentUser.username) {
      const cleanUsername = username.trim();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Validasi gagal', message: 'Username minimal 3 karakter' });
      }

      // Cek ketersediaan username
      const [existing] = await pool.query(
        'SELECT id FROM `app_users` WHERE `username` = ? AND `id` != ?',
        [cleanUsername, userId]
      );
      if ((existing as any[]).length > 0) {
        return res.status(400).json({ error: 'Validasi gagal', message: 'Username sudah digunakan' });
      }

      updates.push('`username` = ?');
      params.push(cleanUsername);
    }

    // Update avatar_url jika diberikan (bisa berupa URL atau Base64)
    if (avatar_url !== undefined) {
      updates.push('`avatar_url` = ?');
      params.push(avatar_url || null);
    }

    // Update password jika diisi
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Validasi gagal',
          message: 'Password saat ini wajib diisi untuk mengganti password',
        });
      }

      const isValidPassword = await authService.verifyPassword(currentPassword, currentUser.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          error: 'Validasi gagal',
          message: 'Password yang anda masukkan berbeda dengan password saat ini.',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'Validasi gagal',
          message: 'Password baru minimal 8 karakter',
        });
      }

      const newHash = await authService.hashPassword(newPassword);
      updates.push('`password_hash` = ?');
      params.push(newHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: 'Tidak ada data yang diubah',
      });
    }

    params.push(userId);
    await pool.execute(
      `UPDATE \`app_users\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
      params
    );

    // Ambil data terbaru setelah update
    const [updatedRows] = await pool.query(
      'SELECT `id`, `username`, `role`, `avatar_url`, `created_at` FROM `app_users` WHERE `id` = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: (updatedRows as any[])[0],
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

/**
 * DELETE /api/profile - Hapus akun pengguna sendiri
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || `ID #${userId}`;

    // Cek apakah user ada
    const [userRows] = await pool.query('SELECT role FROM `app_users` WHERE `id` = ?', [userId]);
    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const role = (userRows as any[])[0].role;

    // Jika admin, cek apakah merupakan satu-satunya admin
    if (role === 'admin') {
      const [adminCount] = await pool.query(
        'SELECT COUNT(*) as count FROM `app_users` WHERE `role` = \'admin\' AND `id` != ?',
        [userId]
      );
      if ((adminCount as any[])[0].count === 0) {
        return res.status(403).json({
          error: 'Akses ditolak',
          message: 'Tidak dapat menghapus akun administrator terakhir',
        });
      }
    }

    // Hapus akun dari database
    await pool.execute('DELETE FROM `app_users` WHERE `id` = ?', [userId]);

    // Hapus session
    await authService.deleteUserSessions(userId);

    // Catat audit log
    await pool.execute(
      'INSERT INTO `admin_audit_logs` (`actor_id`, `action`, `target_id`, `details`) VALUES (?, ?, ?, ?)',
      [userId, 'DELETE_USER', userId, `User "${username}" (ID #${userId}) menghapus akunnya sendiri`]
    );

    // Hapus cookie
    res.clearCookie(authService.COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: 'Akun berhasil dihapus',
    });
  } catch (err: any) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server', message: err.message });
  }
});

export const profileRouter = router;
