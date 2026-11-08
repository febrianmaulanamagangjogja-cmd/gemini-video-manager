import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Play, Square, UserCheck, Trash2, Edit2, Ban, CheckCircle, UserPlus, X, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { accountsApi } from '../lib/services';
import { useToast } from '../context/ToastContext';
import type { GeminiAccount } from '../types';

export const AccountList = () => {
  const [accounts, setAccounts] = useState<GeminiAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [profilePath, setProfilePath] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();

  const [accToToggle, setAccToToggle] = useState<GeminiAccount | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountsApi.getAll();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar akun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !profilePath.trim()) {
      addToast({ type: 'error', message: 'Nama dan profile path wajib diisi.', duration: 4000 });
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingId) {
        await accountsApi.update(editingId, { name, profile_path: profilePath });
        addToast({ type: 'success', message: 'Berhasil memperbarui akun browser.', duration: 3000 });
      } else {
        await accountsApi.create({ name, profile_path: profilePath });
        addToast({ type: 'success', message: 'Berhasil menambahkan akun browser baru.', duration: 3000 });
      }
      setName('');
      setProfilePath('');
      setEditingId(null);
      setShowForm(false);
      fetchAccounts();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Gagal menyimpan akun.', duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (acc: GeminiAccount) => {
    setEditingId(acc.id);
    setName(acc.name);
    setProfilePath(acc.profile_path);
    setShowForm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await accountsApi.delete(deleteId);
      addToast({ type: 'success', message: 'Akun berhasil dihapus.', duration: 3000 });
      fetchAccounts();
      setDeleteId(null);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Gagal menghapus akun.', duration: 5000 });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLaunch = async (id: number) => {
    try {
      const result = await accountsApi.launch(id);
      if (result.success) {
        addToast({ type: 'success', message: 'Browser berhasil dibuka.', duration: 3000 });
      } else {
        const msg = result.message || '';
        let toastMsg = 'Browser gagal dibuka. Coba kembali atau periksa detail masalah.';
        if (msg.includes('in use') || msg.includes('active job')) {
          toastMsg = 'Browser sedang digunakan oleh pekerjaan yang masih berjalan.';
        } else if (msg.includes('Account not found')) {
          toastMsg = 'Akun tidak ditemukan di database.';
        } else if (msg.includes('Profile path')) {
          toastMsg = 'Path profil browser tidak valid atau sedang digunakan.';
        }
        addToast({ type: 'error', message: toastMsg, duration: 5000 });
      }
      fetchAccounts();
    } catch (err: any) {
      addToast({ type: 'error', message: 'Browser gagal dibuka. Coba kembali atau periksa detail masalah.', duration: 5000 });
    }
  };

  const [closeTarget, setCloseTarget] = useState<{ id: number; isBusy: boolean; jobId?: number | null } | null>(null);

  const handleClose = async (id: number, force: boolean = false) => {
    try {
      const result = await accountsApi.close(id, force);
      if (result.success) {
        let toastMsg = 'Browser berhasil ditutup. Sesi login tetap tersimpan.';
        if (force) {
          const acc = accounts.find(a => a.id === id);
          const hasActiveJob = acc?.active_job_id && ['preparing', 'running', 'downloading'].includes(acc.active_job_status || '');
          
          if (hasActiveJob) {
            toastMsg = 'Browser ditutup (paksa). Pekerjaan yang berjalan dibatalkan. Sesi login tetap tersimpan.';
          } else {
            toastMsg = 'Browser berhasil ditutup secara paksa.';
          }
        }
        addToast({ type: 'success', message: toastMsg, duration: 3000 });
      } else {
        let toastMsg = 'Gagal menutup browser.';
        if (result.message?.includes('Profile is in use') || result.message?.includes('active job')) {
          toastMsg = 'Browser sedang digunakan oleh pekerjaan yang masih berjalan. Gunakan tombol Tutup Browser (paksa) untuk membatalkan job dan menutup.';
        }
        addToast({ type: 'error', message: toastMsg, duration: 5000 });
      }
      fetchAccounts();
    } catch (err: any) {
      addToast({ type: 'error', message: 'Gagal menutup browser. Coba kembali.', duration: 5000 });
    } finally {
      setCloseTarget(null);
    }
  };

  const handleCancelAndClose = async () => {
    if (!closeTarget) return;
    await handleClose(closeTarget.id, true);
  };

  const handleToggleDisabledRequest = (acc: GeminiAccount) => {
    setAccToToggle(acc);
  };

  const handleConfirmToggleDisabled = async () => {
    if (!accToToggle) return;
    try {
      const newStatus = accToToggle.status === 'disabled' ? 'available' : 'disabled';
      await accountsApi.update(accToToggle.id, { status: newStatus });
      addToast({
        type: 'success',
        message: newStatus === 'disabled' 
          ? `Akun "${accToToggle.name}" dinonaktifkan dari penjadwalan.` 
          : `Akun "${accToToggle.name}" diaktifkan kembali untuk penjadwalan.`,
        duration: 3000
      });
      fetchAccounts();
      setAccToToggle(null);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Gagal mengubah status akun.', duration: 5000 });
    }
  };

  const handleCheckLogin = async (id: number) => {
    try {
      const result = await accountsApi.checkLogin(id);
      let toastMsg = 'Status login belum bisa dipastikan. Periksa jendela browser.';
      let toastType: 'success' | 'warning' | 'info' | 'error' = 'info';

      if (result.status === 'available') {
        if (result.message?.includes('Authenticated')) {
          toastMsg = 'Akun Gemini siap digunakan.';
          toastType = 'success';
        } else {
          toastMsg = 'Browser aktif. Status login tersedia.';
          toastType = 'success';
        }
      } else if (result.status === 'busy') {
        toastMsg = 'Browser sedang digunakan oleh pekerjaan yang masih berjalan.';
        toastType = 'warning';
      } else if (result.status === 'login_required') {
        toastMsg = 'Silakan masuk ke akun Google pada jendela browser.';
        toastType = 'info';
      } else if (result.status === 'unknown' || result.status === 'unavailable') {
        toastMsg = 'Sesi browser tidak dapat digunakan. Buka kembali browser dan periksa status login.';
        toastType = 'error';
      }

      addToast({ type: toastType, message: toastMsg, duration: 4000 });
      fetchAccounts();
    } catch (err: any) {
      addToast({ type: 'error', message: 'Gagal memeriksa status login.', duration: 5000 });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kelola Akun Browser</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Daftar akun profil browser Gemini terdaftar untuk rotasi pekerjaan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchAccounts}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setName(''); setProfilePath(''); }}>
            <Plus className="h-4 w-4" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
                <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 transform overflow-hidden transition-all duration-300 ease-in-out sm:scale-100">
                  {/* Header Modal */}
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {editingId ? (
                        <UserPlus className="h-5 w-5 text-violet-600" />
                      ) : (
                        <UserPlus className="h-5 w-5 text-violet-600" />
                      )}
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {editingId ? 'Edit Akun' : 'Tambah Akun Baru'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {editingId ? 'Perbarui detail akun browser' : 'Daftar akun baru untuk rotasi pekerjaan'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowForm(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label="Batal"
                    >
                      <X className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                    </button>
                  </div>

                  {/* Form Content */}
                  <form
                    onSubmit={handleSubmit}
                    className="p-5 sm:p-6 space-y-5"
                  >
                    {/* Nama Akun Field */}
                    <div>
                      <Input
                        id="account-name"
                        label="Nama Akun *"
                        placeholder="Contoh: Akun Utama 1"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>

                    {/* Profile Path Field */}
                    <div>
                      <Input
                        id="profile-path"
                        label="Profile Path *"
                        className="font-mono text-sm"
                        placeholder="Contoh: C:/Users/User/AppData/Local/Google/Chrome/User Data/Profile 1"
                        value={profilePath}
                        onChange={(e) => setProfilePath(e.target.value)}
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Lokasi absolut direktori profil browser (contoh: C:/Users/User/AppData/Local/Google/Chrome/User Data/Profile 1). Sesi login Google akan disimpan di direktori ini.
                      </p>
                    </div>

                    {/* Submit Bar */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowForm(false)}
                        disabled={isSubmitting}
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim() || !profilePath.trim()}
                        className="flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            {editingId ? 'Simpan Perubahan' : 'Tambah'}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Nama Akun</th>
                <th className="py-3 px-4">Profile Path</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Pekerjaan Selesai</th>
                <th className="py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Memuat akun...</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Belum ada akun terdaftar.</td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-mono text-gray-500">#{acc.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{acc.name}</span>
                        {acc.is_busy && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Busy (Job #{acc.active_job_id || '...'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500 max-w-xs truncate">{acc.profile_path}</td>
                    <td className="py-3 px-4"><Badge status={acc.status} /></td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{acc.completed_job_count} / {acc.total_job_count}</td>
                    <td className="py-3 px-4 flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(acc)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(acc.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                      {deleteId === acc.id && (
                        <ConfirmDialog
                          isOpen={deleteId === acc.id}
                          title="Hapus Akun"
                          message={`Apakah Anda yakin ingin menghapus akun "${acc.name}"? Tindakan ini tidak dapat dibatalkan.`}
                          confirmLabel="Hapus"
                          cancelLabel="Batal"
                          variant="danger"
                          isLoading={isDeleting}
                          onConfirm={handleConfirmDelete}
                          onClose={() => setDeleteId(null)}
                        />
                      )} {!acc.is_running && acc.status !== 'busy' && (
                        <Button variant="outline" size="sm" onClick={() => handleLaunch(acc.id)}>
                          <Play className="h-4 w-4" />
                          Buka Browser
                        </Button>
                      )}
                      {acc.is_running && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setCloseTarget({ 
                            id: acc.id, 
                            isBusy: !!acc.is_busy, 
                            jobId: acc.active_job_id 
                          })}
                        >
                          <Square className="h-4 w-4" />
                          Tutup Browser
                        </Button>
                      )}
                      {closeTarget && closeTarget.id === acc.id && (
                        <ConfirmDialog
                          isOpen={!!closeTarget}
                          title={closeTarget.isBusy ? "Peringatan: Browser Sedang Digunakan" : "Tutup Browser"}
                          message={
                            closeTarget.isBusy 
                              ? `Profil browser ini sedang digunakan oleh Pekerjaan #${closeTarget.jobId || 'aktif'}. Menutup browser akan membatalkan pekerjaan tersebut.\n\nRiwayat pekerjaan, file video yang sudah tersimpan, dan sesi login persisten tidak akan dihapus.`
                              : "Jendela browser akan ditutup. Data profil dan sesi login persisten Anda tetap tersimpan dan tidak akan terhapus."
                          }
                          confirmLabel={closeTarget.isBusy ? "Batalkan Job dan Tutup Browser" : "Tutup Browser"}
                          cancelLabel="Batal"
                          variant={closeTarget.isBusy ? "danger" : "warning"}
                          onConfirm={handleCancelAndClose}
                          onClose={() => setCloseTarget(null)}
                        />
                      )}
                      {acc.is_running && (
                        <Button variant="outline" size="sm" onClick={() => handleCheckLogin(acc.id)}>
                          <UserCheck className="h-4 w-4" />
                          Cek Login
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleToggleDisabledRequest(acc)}
                        title={acc.status === 'disabled' ? 'Aktifkan Akun' : 'Nonaktifkan Akun'}
                      >
                        {acc.status === 'disabled' ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Ban className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                        )}
                      </Button>
                      {accToToggle && accToToggle.id === acc.id && (
                        <ConfirmDialog
                          isOpen={!!accToToggle}
                          title={accToToggle.status === 'disabled' ? 'Aktifkan Akun' : 'Nonaktifkan Akun'}
                          message={`Apakah Anda yakin ingin ${accToToggle.status === 'disabled' ? 'mengaktifkan kembali' : 'menonaktifkan'} akun "${accToToggle.name}"? ${accToToggle.status === 'disabled' ? 'Akun akan kembali tersedia untuk rotasi pekerjaan.' : 'Akun tidak akan digunakan untuk rotasi pekerjaan otomatis.'}`}
                          confirmLabel={accToToggle.status === 'disabled' ? 'Aktifkan' : 'Nonaktifkan'}
                          cancelLabel="Batal"
                          variant={accToToggle.status === 'disabled' ? 'primary' : 'warning'}
                          onConfirm={handleConfirmToggleDisabled}
                          onClose={() => setAccToToggle(null)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
