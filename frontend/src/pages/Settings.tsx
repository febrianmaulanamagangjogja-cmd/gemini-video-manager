import { useState, useEffect } from 'react';
import { Clock3, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSettings, type RefreshInterval, type RetryConfig } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const refreshOptions: Array<{ value: RefreshInterval; label: string; description: string }> = [
  { value: 0, label: 'Nonaktif', description: 'Daftar tugas hanya diperbarui saat halaman dibuka atau tombol segarkan ditekan.' },
  { value: 10, label: 'Setiap 10 detik', description: 'Cocok saat sedang memantau proses pembuatan video.' },
  { value: 30, label: 'Setiap 30 detik', description: 'Pilihan seimbang untuk pemantauan rutin.' },
  { value: 60, label: 'Setiap 1 menit', description: 'Mengurangi permintaan ke backend.' },
];

const maxRetriesOptions: Array<{ value: RetryConfig['maxRetries']; label: string; description: string }> = [
  { value: 1, label: '1 kali', description: 'Mencoba sekali saat gagal, cepat melanjutkan ke tugas berikutnya.' },
  { value: 2, label: '2 kali', description: 'Memberikan kesempatan kedua sebelum menyerah.' },
  { value: 3, label: '3 kali (Disarankan)', description: 'Seimbang antara ketahanan dan kecepatan proses.' },
  { value: 4, label: '4 kali', description: 'Lebih ketahanan untuk jaringan tidak stabil.' },
  { value: 5, label: '5 kali', description: 'Maksimal percobaan untuk mengurangi kegagalan total.' },
];

const downloadTimeoutOptions: Array<{ value: RetryConfig['downloadTimeout']; label: string; description: string }> = [
  { value: 5, label: '5 detik', description: 'Cepat mendeteksi timeout, cocok jaringan cepat.' },
  { value: 10, label: '10 detik', description: 'Seimbang untuk kebanyakan situasi.' },
  { value: 30, label: '30 detik (Disarankan)', description: 'Memberi waktu cukup untuk file video besar.' },
  { value: 60, label: '60 detik', description: 'Toleransi tinggi untuk jaringan lambat.' },
  { value: 120, label: '120 detik', description: 'Maksimal toleransi untuk file sangat besar.' },
];

const cacheCleanOptions: Array<{ value: RetryConfig['cacheCleanInterval']; label: string; description: string }> = [
  { value: 30, label: 'Setiap 30 menit', description: 'Pembersihan agresif, minimal penggunaan disk.' },
  { value: 60, label: 'Setiap 1 jam (Disarankan)', description: 'Seimbang antara performa dan ruang disk.' },
  { value: 180, label: 'Setiap 3 jam', description: 'Kurang sering, cocok disk besar.' },
  { value: 360, label: 'Setiap 6 jam', description: 'Minimal pembersihan, menjaga cache lebih lama.' },
];

export function SettingsPage() {
  const { refreshInterval, setRefreshInterval, retryConfig, setRetryConfig } = useSettings();
  const { user } = useAuth();
  const { addToast } = useToast();

  // Local draft state agar tidak langsung tersimpan otomatis
  const [localRefreshInterval, setLocalRefreshInterval] = useState<RefreshInterval>(refreshInterval);
  const [localRetryConfig, setLocalRetryConfig] = useState<RetryConfig>(retryConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Sinkronisasi state lokal saat context berubah atau dimuat awal
  useEffect(() => {
    setLocalRefreshInterval(refreshInterval);
  }, [refreshInterval]);

  useEffect(() => {
    setLocalRetryConfig(retryConfig);
  }, [retryConfig]);

  const isAdmin = user?.role === 'admin';

  const handleSaveAllSettings = async () => {
    setIsSaving(true);
    try {
      // 1. Simpan ke local context dan storage spesifik user
      setRefreshInterval(localRefreshInterval);
      setRetryConfig(localRetryConfig);

      // 2. Simpan ke endpoint backend terisolasi (user_id session)
      if (!isAdmin) {
        await fetch('/api/settings/user', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localRetryConfig),
        });
      }

      addToast({ type: 'success', message: 'Pengaturan berhasil disimpan.' });
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
      addToast({ type: 'error', message: 'Gagal menyimpan pengaturan.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pengaturan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Konfigurasi preferensi aplikasi Anda.
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="md"
            disabled={isSaving}
            onClick={handleSaveAllSettings}
            className="shadow-md shadow-violet-500/20"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </div>
      </div>

      <Card title="Pemantauan Antrean" description="Atur pembaruan otomatis untuk halaman Antrean & Riwayat.">
        <div className="space-y-4">
          <div className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
            <Clock3 className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <p>Pengaturan ini membantu memantau perubahan status tugas tanpa memuat ulang halaman secara manual.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-100">Interval pembaruan otomatis</legend>
            {refreshOptions.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60">
                <input
                  type="radio"
                  name="refresh-interval"
                  value={option.value}
                  checked={localRefreshInterval === option.value}
                  onChange={() => setLocalRefreshInterval(option.value)}
                  className="mt-1 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </Card>

      {/* Sembunyikan opsi Otomasi & Unduhan pada halaman Pengaturan ketika yang login adalah admin */}
      {!isAdmin && (
        <Card title="Otomasi & Unduhan" description="Konfigurasi ketahanan dan batas waktu untuk proses pembuatan video otomatis Anda.">
          <div className="space-y-6">
            {/* Auto Retry Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Auto-Retry Job Gagal</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Secara otomatis mengulang pembuatan video jika terjadi kegagalan jaringan atau timeout dari Gemini.</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localRetryConfig.autoRetry}
                  onChange={(e) => setLocalRetryConfig({ ...localRetryConfig, autoRetry: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {/* Max Retries - only show if autoRetry is enabled */}
            {localRetryConfig.autoRetry && (
              <div className="space-y-2">
                <legend className="text-sm font-medium text-gray-900 dark:text-gray-100">Batas Maksimal Percobaan Ulang</legend>
                {maxRetriesOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60">
                    <input
                      type="radio"
                      name="max-retries"
                      value={option.value}
                      checked={localRetryConfig.maxRetries === option.value}
                      onChange={() => setLocalRetryConfig({ ...localRetryConfig, maxRetries: option.value })}
                      className="mt-1 h-4 w-4 accent-violet-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Download Timeout */}
            <div className="space-y-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-100">Batas Waktu Unduhan Otomatis</legend>
              {downloadTimeoutOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60">
                  <input
                    type="radio"
                    name="download-timeout"
                    value={option.value}
                    checked={localRetryConfig.downloadTimeout === option.value}
                    onChange={() => setLocalRetryConfig({ ...localRetryConfig, downloadTimeout: option.value })}
                    className="mt-1 h-4 w-4 accent-violet-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Cache Clean Interval */}
            <div className="space-y-2">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-100">Pembersihan Cache Profil Berkala</legend>
              {cacheCleanOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60">
                  <input
                    type="radio"
                    name="cache-clean"
                    value={option.value}
                    checked={localRetryConfig.cacheCleanInterval === option.value}
                    onChange={() => setLocalRetryConfig({ ...localRetryConfig, cacheCleanInterval: option.value })}
                    className="mt-1 h-4 w-4 accent-violet-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Video Integrity Validation */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Validasi Integritas File Video</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Memastikan file video yang diunduh utuh dan dapat diputar sebelum tugas dinyatakan selesai.</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localRetryConfig.validateVideoIntegrity}
                  onChange={(e) => setLocalRetryConfig({ ...localRetryConfig, validateVideoIntegrity: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        {!isAdmin && (
          <Button
            size="md"
            disabled={isSaving}
            onClick={handleSaveAllSettings}
            className="shadow-md shadow-violet-500/20"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        )}
      </div>
    </div>
  );
}
