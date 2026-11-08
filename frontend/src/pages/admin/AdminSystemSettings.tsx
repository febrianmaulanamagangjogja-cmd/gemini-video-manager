import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { adminApi, type SystemSettings } from '../../lib/adminServices';
import { Settings, RotateCcw, Save, Image } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function AdminSystemSettings() {
  const { setWebsiteConfig } = useSettings();
  const [settings, setSettings] = useState<SystemSettings>({
    autoRetry: false,
    maxRetries: 3,
    downloadTimeout: 30,
    cacheCleanInterval: 60,
    validateVideoIntegrity: true,
    websiteName: 'Gemini Video Manager',
    websiteIcon: '',
  });
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [iconPreview, setIconPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await adminApi.getSystemSettings();
        if (data) {
          setSettings(data as SystemSettings);
          setIconPreview(data.websiteIcon || '');
        }
      } catch (err: any) {
        addToast({ message: err.message || 'Gagal memuat pengaturan sistem', type: 'error' });
      }
    };
    loadSettings();
  }, [addToast]);

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({ message: 'Hanya file gambar yang diperbolehkan', type: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast({ message: 'Ukuran file ikon tidak boleh lebih dari 2MB', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const base64 = event.target.result;
        setIconPreview(base64);
        setSettings(prev => ({ ...prev, websiteIcon: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = async () => {
    const defaultSettings: SystemSettings = {
      autoRetry: false,
      maxRetries: 3,
      downloadTimeout: 30,
      cacheCleanInterval: 60,
      validateVideoIntegrity: true,
      websiteName: 'Gemini Video Manager',
      websiteIcon: '',
    };
    setSettings(defaultSettings);
    setIconPreview('');
    setWebsiteConfig({
      websiteName: defaultSettings.websiteName,
      websiteIcon: defaultSettings.websiteIcon,
    });
    try {
      await adminApi.updateSystemSettings(defaultSettings);
      addToast({ message: 'Pengaturan telah direset ke default dan disimpan ke server', type: 'info' });
    } catch (err: any) {
      addToast({ message: err.message || 'Gagal mereset pengaturan ke server', type: 'error' });
    }
    setShowResetConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSystemSettings(settings);
      setWebsiteConfig({
        websiteName: settings.websiteName,
        websiteIcon: settings.websiteIcon,
      });
      addToast({ message: 'Pengaturan sistem berhasil disimpan', type: 'success' });
    } catch (err: any) {
      addToast({ message: err.message || 'Gagal menyimpan pengaturan', type: 'error' });
    } finally {
      setSaving(false);
      setShowSaveConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Pengaturan Sistem
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Konfigurasi branding aplikasi dan parameter operasional sistem
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Default
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-600/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Website Branding Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
            <Settings className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Branding & Identitas Website
            </h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Website
            </label>
            <input
              type="text"
              value={settings.websiteName}
              onChange={(e) => {
                const newName = e.target.value;
                setSettings({ ...settings, websiteName: newName });
                setWebsiteConfig({ websiteName: newName });
              }}
              className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Gemini Video Manager"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Nama website yang ditampilkan pada navigasi header dan judul tab browser.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ikon Website
            </label>
            <div className="flex items-center gap-4">
              <div
                onClick={handleIconClick}
                className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer hover:border-violet-500 transition-colors group"
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Website Icon" className="w-full h-full object-contain" />
                ) : (
                  <Image className="w-6 h-6 text-gray-400 group-hover:text-violet-500" />
                )}
              </div>
              <button
                type="button"
                onClick={handleIconClick}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Pilih dari Galeri
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Klik gambar atau tombol untuk mengunggah ikon baru (maks 2MB, format JPG, PNG).
            </p>
          </div>
        </div>

        {/* Operational & Download Settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="pb-2 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Otomasi & Unduhan
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Konfigurasi parameter retry dan proses otomatisasi unduhan video
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Auto-Retry Job Gagal
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Otomatis mencoba kembali ketika pekerjaan gagal
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoRetry}
                onChange={(e) => setSettings({ ...settings, autoRetry: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Validasi Integritas Video
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Verifikasi kelayakan file video yang selesai diunduh
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.validateVideoIntegrity}
                onChange={(e) => setSettings({ ...settings, validateVideoIntegrity: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Maksimal Percobaan (Retries)
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Batas pengulangan jika proses gagal
                </span>
              </div>
              <select
                value={settings.maxRetries}
                onChange={(e) => setSettings({ ...settings, maxRetries: parseInt(e.target.value, 10) })}
                className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value={1}>1 kali</option>
                <option value={2}>2 kali</option>
                <option value={3}>3 kali (Disarankan)</option>
                <option value={4}>4 kali</option>
                <option value={5}>5 kali</option>
              </select>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Timeout Unduhan (Detik)
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Batas waktu toleransi tunggu proses unduhan
                </span>
              </div>
              <select
                value={settings.downloadTimeout}
                onChange={(e) => setSettings({ ...settings, downloadTimeout: parseInt(e.target.value, 10) })}
                className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value={5}>5 detik</option>
                <option value={10}>10 detik</option>
                <option value={30}>30 detik (Disarankan)</option>
                <option value={60}>60 detik</option>
                <option value={120}>120 detik</option>
              </select>
            </div>
          </div>
        </div>
      </form>

      {/* Confirm Dialog Reset Default */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleConfirmReset}
        title="Reset Pengaturan ke Default"
        message="Apakah Anda yakin ingin mereset semua pengaturan sistem ke nilai default? Perubahan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Reset ke Default"
        cancelLabel="Batal"
        variant="danger"
      />

      {/* Confirm Dialog Simpan Pengaturan */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={handleConfirmSave}
        title="Simpan Pengaturan Sistem"
        message="Apakah Anda yakin ingin menyimpan perubahan pengaturan sistem ini?"
        confirmLabel="Ya, Simpan"
        cancelLabel="Batal"
        variant="primary"
      />
    </div>
  );
}

export default AdminSystemSettings;
