/**
 * Helper functions untuk membuat log audit menjadi human-readable (Bahasa Indonesia)
 */

export interface AuditLogEntry {
  id: number;
  action: string;
  actor_id: number;
  target_id?: number | null;
  details: string;
  created_at: string;
}

/**
 * Menerjemahkan action code menjadi label yang mudah dipahami
 */
export function translateAction(action: string): string {
  const actionMap: Record<string, string> = {
    'CREATE_USER': 'Tambah Pengguna',
    'UPDATE_USER': 'Ubah Data Pengguna',
    'DELETE_USER': 'Hapus Pengguna',
    'RESET_PASSWORD': 'Reset Password',
    'TOGGLE_ACTIVE': 'Ubah Status Aktif',
    'TOGGLE_ROLE': 'Ubah Role',
    'LOGIN': 'Login',
    'LOGOUT': 'Logout',
    'CREATE_JOB': 'Buat Pekerjaan Video',
    'UPDATE_JOB': 'Ubah Pekerjaan Video',
    'DELETE_JOB': 'Hapus Pekerjaan Video',
    'CANCEL_JOB': 'Batalkan Pekerjaan',
    'DOWNLOAD_VIDEO': 'Unduh Video',
  };
  
  return actionMap[action] || action;
}

/**
 * Menerjemahkan detail log teknis menjadi kalimat Bahasa Indonesia yang mudah dipahami
 */
export function translateDetails(action: string, details: string, targetUsername?: string | null): string {
  // CREATE_USER: "User \"username\" dibuat dengan role user"
  if (action === 'CREATE_USER') {
    const match = details.match(/User "([^"]+)" dibuat dengan role (\w+)/);
    const username = targetUsername || (match ? match[1] : null);
    if (username) {
      const roleMatch = details.match(/role (\w+)/);
      const roleStr = roleMatch && roleMatch[1] === 'admin' ? 'Administrator' : 'Pengguna Biasa';
      return `Membuat pengguna baru "${username}" dengan peran ${roleStr}`;
    }
    return `Membuat pengguna baru`;
  }

  // UPDATE_USER: "User ID 16 diperbarui: {\"is_active\":false}" atau "User \"target\" (ID #16) diperbarui..."
  if (action === 'UPDATE_USER') {
    const userMatch = details.match(/User "([^"]+)"/);
    const userIdMatch = details.match(/User ID (\d+)/) || details.match(/\(ID #(\d+)\)/);
    const targetName = targetUsername || (userMatch ? userMatch[1] : (userIdMatch ? `#${userIdMatch[1]}` : ''));

    const changesMatch = details.match(/diperbarui:\s*(.+)$/);
    if (changesMatch) {
      try {
        const parsed = JSON.parse(changesMatch[1]);
        const parts: string[] = [];
        
        if (parsed.is_active !== undefined) {
          parts.push(parsed.is_active ? 'mengaktifkan' : 'menonaktifkan (blokir)');
        }
        if (parsed.role !== undefined) {
          parts.push(`mengubah peran menjadi ${parsed.role === 'admin' ? 'Administrator' : 'Pengguna Biasa'}`);
        }
        if (parsed.password !== undefined) {
          parts.push('mengubah password');
        }
        
        if (parts.length > 0) {
          return targetName ? `Memperbarui pengguna "${targetName}": ${parts.join(' dan ')}` : `Memperbarui pengguna: ${parts.join(' dan ')}`;
        }
      } catch {
        // Jika bukan JSON valid
      }
    }
    
    return targetName ? `Memperbarui data pengguna "${targetName}"` : 'Memperbarui data pengguna';
  }

  // RESET_PASSWORD: "Password untuk \"username\" berhasil direset ke password sementara (\"TempPass123!\")"
  if (action === 'RESET_PASSWORD') {
    const match = details.match(/Password untuk "([^"]+)"/);
    const name = targetUsername || (match ? match[1] : null);
    if (name) {
      return `Meriset password pengguna "${name}" ke password sementara`;
    }
    return 'Meriset password pengguna';
  }

  // DELETE_USER
  if (action === 'DELETE_USER') {
    const match = details.match(/User "([^"]+)"/);
    const matchId = details.match(/User ID (\d+)/);
    const name = targetUsername || (match ? match[1] : (matchId ? `ID #${matchId[1]}` : null));
    if (name) {
      return `Menghapus pengguna "${name}"`;
    }
    return 'Menghapus pengguna';
  }

  // TOGGLE_ACTIVE (alternatif format)
  if (action === 'TOGGLE_ACTIVE') {
    const match = details.match(/User ID (\d+) (diaktifkan|dinonaktifkan)/);
    const name = targetUsername || (match ? `#${match[1]}` : null);
    const actionText = (match && match[2] === 'diaktifkan') ? 'Mengaktifkan' : 'Menonaktifkan (blokir)';
    if (name) {
      return `${actionText} pengguna "${name}"`;
    }
    return 'Mengubah status aktif pengguna';
  }

  // TOGGLE_ROLE
  if (action === 'TOGGLE_ROLE') {
    const match = details.match(/User ID (\d+) role diubah ke (\w+)/);
    const name = targetUsername || (match ? `#${match[1]}` : null);
    if (match && name) {
      return `Mengubah peran pengguna "${name}" menjadi ${match[2] === 'admin' ? 'Administrator' : 'Pengguna Biasa'}`;
    }
    return 'Mengubah peran pengguna';
  }

  // Fallback: return as-is jika tidak dikenali
  return details;
}

/**
 * Mendapatkan warna badge berdasarkan action
 */
export function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    'CREATE_USER': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    'UPDATE_USER': 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    'DELETE_USER': 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
    'RESET_PASSWORD': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    'TOGGLE_ACTIVE': 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
    'TOGGLE_ROLE': 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  };
  
  return colorMap[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

/**
 * Mendapatkan ikon untuk action
 */
export function getActionIcon(action: string) {
  const iconMap: Record<string, string> = {
    'CREATE_USER': 'UserPlus',
    'UPDATE_USER': 'Edit',
    'DELETE_USER': 'Trash2',
    'RESET_PASSWORD': 'Key',
    'TOGGLE_ACTIVE': 'Shield',
    'TOGGLE_ROLE': 'UserCog',
  };
  
  return iconMap[action] || 'Activity';
}