import { useState, useRef, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { User, Lock, Camera, Save, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar_url || '');

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Confirmation dialogs
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteAvatarConfirm, setShowDeleteAvatarConfirm] = useState(false);

  // Field-specific password errors
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);

  // Check if any changes have been made
  const hasChanges = 
    username !== (user?.username || '') ||
    avatarPreview !== (user?.avatar_url || '') ||
    Boolean(currentPassword) ||
    Boolean(newPassword) ||
    Boolean(confirmPassword);

  // Validation
  const getValidationMessage = () => {
    if (!username.trim()) return 'Username tidak boleh kosong';
    if (username.length < 3) return 'Username minimal 3 karakter';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Username hanya boleh mengandung huruf, angka, dan garis bawah';
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) return 'Masukkan password saat ini untuk mengubah password';
      if (!newPassword) return 'Masukkan password baru';
      if (newPassword.length < 8) return 'Password baru minimal 8 karakter';
      if (newPassword === currentPassword) return 'Password baru yang anda masukkan sama dengan password saat ini. Masukkan password berbeda.';
      if (newPassword !== confirmPassword) return 'Konfirmasi password baru tidak sama dengan password baru';
    }

    return null;
  };

  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword) {
      setCurrentPasswordError(null);
      return;
    }
    try {
      const res = await api.post<{ valid: boolean }>('/profile/verify-password', { password: currentPassword });
      if (!res.data.valid) {
        setCurrentPasswordError('Password yang anda masukkan berbeda dengan password saat ini.');
      } else {
        setCurrentPasswordError(null);
      }
    } catch {
      // ignore
    }
  };

  // Inline validation for password fields
  // Using direct checks in UI or getValidationMessage

  // Avatar handling
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast({ message: 'Hanya file gambar yang diperbolehkan', type: 'error' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({ message: 'Ukuran file tidak boleh lebih dari 5MB', type: 'error' });
      return;
    }

    // Read as Data URL (base64)
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setAvatarPreview(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const executeDeleteAvatar = async () => {
    setIsSubmitting(true);
    try {
      const response = await api.put<any>('/profile', {
        username: username.trim(),
        avatar_url: '', // Empty string to clear avatar
      });

      if ((response.data as any)?.user) {
        updateUser((response.data as any).user);
      }

      setAvatarPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      addToast({ message: 'Foto profil berhasil dihapus', type: 'success' });
    } catch (err: any) {
      addToast({ message: err.response?.data?.message || 'Gagal menghapus foto profil', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setShowDeleteAvatarConfirm(false);
    }
  };

  // Form submission
  const executeSubmit = async () => {
    const validationError = getValidationMessage();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const payload: {
        username: string;
        avatar_url?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {
        username: username.trim(),
      };

      if (avatarPreview !== (user?.avatar_url || '')) {
        payload.avatar_url = avatarPreview;
      }

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      // Send to server
      const response = await api.put<any>('/profile', payload);

      // Update user context
      if ((response.data as any)?.user) {
        updateUser((response.data as any).user);
      }

      addToast({ message: 'Profil berhasil diperbarui', type: 'success' });

      // Clear sensitive fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPasswordError(null);

    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Gagal memperbarui profil';
      if (message.includes('Password yang anda masukkan berbeda') || message.includes('Password saat ini')) {
        setCurrentPasswordError('Password yang anda masukkan berbeda dengan password saat ini.');
      } else {
        setError(message);
      }
      addToast({ message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = getValidationMessage();
    if (validationError) {
      setError(validationError);
      addToast({ message: validationError, type: 'error' });
      return;
    }
    setError(null);
    setShowSaveConfirm(true);
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const executeCancel = () => {
    setUsername(user?.username || '');
    setAvatarPreview(user?.avatar_url || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPasswordError(null);
    setError(null);
    setShowCancelConfirm(false);
    addToast({ message: 'Perubahan dibatalkan', type: 'info' });
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/profile');
      addToast({ message: 'Akun berhasil dihapus', type: 'success' });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Gagal menghapus akun';
      addToast({ message: message, type: 'error' });
    } finally {
      setShowDeleteConfirm(false);
      // Redirect to login or home after account deletion
      window.location.href = '/login';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil Pengguna</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola informasi profil dan pengaturan keamanan akun Anda</p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Avatar Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Foto Profil</h2>

          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-center overflow-hidden group"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  {avatarPreview ? 'Ganti Foto' : 'Unggah Foto'}
                </button>
                {Boolean(avatarPreview) && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteAvatarConfirm(true)}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Foto Profil
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Maksimal 5MB (JPG, PNG, GIF). Foto akan ditampilkan di header dan di seluruh aplikasi.
              </p>
            </div>
          </div>
        </div>

        {/* Basic Information Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi Dasar</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
                  placeholder="Masukkan username baru"
                />
              </div>
              {error && error.includes('username') && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Username harus unik dan hanya mengandung huruf, angka, dan garis bawah</p>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keamanan Password</h2>
            <Lock className="w-5 h-5 text-gray-400" />
          </button>

          {showPasswordSection && (
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password Saat Ini
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (currentPasswordError) setCurrentPasswordError(null);
                    }}
                    onBlur={handleVerifyCurrentPassword}
                    className="w-full pr-12 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
                    placeholder="Masukkan password saat ini"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {currentPasswordError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{currentPasswordError}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pr-12 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
                    placeholder="Masukkan password baru"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {newPassword && currentPassword && newPassword === currentPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Password baru yang anda masukkan sama dengan password saat ini. Masukkan password berbeda.</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pr-12 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
                    placeholder="Konfirmasi password baru"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Konfirmasi password baru tidak sama dengan password baru</span>
                  </p>
                )}
              </div>

              {(error && (error.includes('password') || error.includes('Konfirmasi'))) && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500">Password minimal 8 karakter</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && !error.includes('username') && !error.includes('password') && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          {hasChanges && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>

      {/* Delete Avatar Confirmation Dialog */}
      {showDeleteAvatarConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Hapus Foto Profil
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus foto profil? Tampilan akan kembali ke avatar default.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteAvatarConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteAvatar}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Dialog */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Konfirmasi Simpan Perubahan
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menyimpan perubahan pada profil Anda?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveConfirm(false);
                  executeSubmit();
                }}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors"
              >
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Konfirmasi Pembatalan
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin membatalkan perubahan? Semua perubahan yang belum disimpan akan dikembalikan.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={executeCancel}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">Zona Berbahaya</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Menghapus akun adalah tindakan permanen dan tidak dapat dibatalkan. Semua data Anda akan hilang.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="px-6 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/50 rounded-xl transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Akun
        </button>
      </div>

      {/* Delete Account Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Hapus Akun?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus akun Anda? Tindakan ini tidak dapat dibatalkan dan semua data akan hilang.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
