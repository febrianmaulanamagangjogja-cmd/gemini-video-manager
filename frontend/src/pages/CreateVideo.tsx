import { useState, useEffect, type DragEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { Alert } from '../components/ui/Alert';
import { jobsApi, accountsApi } from '../lib/services';
import { useToast } from '../context/ToastContext';
import type { GeminiAccount } from '../types';
import { Upload, Info, Plus } from 'lucide-react';

interface BatchCard {
  id: number;
  prompt: string;
  reference_image_path: string | null;
  previewUrl: string | null;
}

export function CreateVideo() {
  const [batch, setBatch] = useState<BatchCard[]>([
    { id: Date.now(), prompt: '', reference_image_path: null, previewUrl: null },
  ]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<GeminiAccount[]>([]);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    async function loadAccounts() {
      try {
        const data = await accountsApi.getAll();
        setAccounts(data);
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    }
    loadAccounts();
  }, []);

  const addBatchEntry = () => {
    setBatch((prev) => [
      ...prev,
      { id: Date.now(), prompt: '', reference_image_path: null, previewUrl: null },
    ]);
  };

  const removeBatchEntry = (id: number) => {
    setBatch((prev) => prev.filter((entry) => entry.id !== id));
  };

  const duplicateBatchEntry = (id: number) => {
    const entryToCopy = batch.find((item) => item.id === id);
    if (!entryToCopy) return;
    setBatch((prev) => [
      ...prev,
      {
        ...entryToCopy,
        id: Date.now(),
      },
    ]);
  };

  const updateBatchEntryPrompt = (id: number, prompt: string) => {
    setBatch((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, prompt } : entry))
    );
  };

  const updateBatchEntryImage = (
    id: number,
    file: File | null,
    previewUrl: string | null
  ) => {
    setBatch((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, reference_image_path: null, previewUrl }
          : entry
      )
    );
    // Upload to server if file provided
    if (file) {
      setError(null);
      jobsApi.uploadReferenceImage(file)
        .then((res) => {
          setBatch((prev) =>
            prev.map((entry) =>
              entry.id === id
                ? { ...entry, reference_image_path: res.file_path }
                : entry
            )
          );
        })
        .catch((err: any) => {
          setError(
            err.message || 'Gagal mengunggah gambar referensi ke server.'
          );
        });
    }
  };

  const removeBatchEntryImage = (id: number) => {
    setBatch((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, reference_image_path: null, previewUrl: null } : entry
      )
    );
  };

  const handleBatchFileDrop = (id: number, e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleBatchFileSelect(id, file);
    }
  };

  const handleBatchFileSelect = (id: number, file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Format gambar tidak valid. Gunakan file JPG, PNG, WEBP, atau GIF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file terlalu besar. Maksimal 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBatchEntryImage(id, file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate each batch entry
    const validEntries: Array<{
      prompt: string;
      reference_image_path: string | null;
      aspect_ratio: '9:16' | '16:9';
      account_id: number | null;
    }> = [];

    for (let i = 0; i < batch.length; i++) {
      const entry = batch[i];
      const trimmedPrompt = entry.prompt.trim();
      if (!trimmedPrompt) {
        setError(`Prompt pada Video #${i + 1} tidak boleh kosong.`);
        return;
      }
      validEntries.push({
        prompt: trimmedPrompt,
        reference_image_path: entry.reference_image_path || null,
        aspect_ratio: selectedAspectRatio,
        account_id: selectedAccountId,
      });
    }

    if (validEntries.length === 0) {
      setError('Minimal satu kartu video dengan prompt wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      const promises = validEntries.map((jobData) => jobsApi.create(jobData));
      await Promise.all(promises);

      addToast({
        type: 'success',
        message: `Berhasil menambahkan ${validEntries.length} pekerjaan video ke antrean!`,
        duration: 4000,
      });

      // Reset form
      setBatch([
        { id: Date.now(), prompt: '', reference_image_path: null, previewUrl: null },
      ]);
      setSelectedAspectRatio('9:16');
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan pekerjaan ke antrean.');
      addToast({
        type: 'error',
        message: err.message || 'Gagal menambahkan pekerjaan ke antrean.',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Buat Video Baru
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Buat video dalam batch dengan pilih rasio aspek, prompt, dan gambar referensi opsional.
        </p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Aspect Ratio Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                Pilih Format & Rasio Aspek Video *
              </label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                {selectedAspectRatio === '9:16' ? 'Vertikal (Shorts / Reels / TikTok)' : 'Horizontal (YouTube Widescreen)'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Opsi 9:16 Portrait */}
              <button
                type="button"
                onClick={() => setSelectedAspectRatio('9:16')}
                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 ${
                  selectedAspectRatio === '9:16'
                    ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/40 ring-2 ring-violet-500/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Visualizer Frame 9:16 (Tinggi Vertikal) */}
                <div className={`w-14 h-16 rounded-lg flex items-center justify-center shrink-0 border-2 transition-colors ${
                  selectedAspectRatio === '9:16'
                    ? 'bg-violet-100 dark:bg-violet-900/60 border-violet-500'
                    : 'bg-gray-100 dark:bg-gray-700/60 border-gray-300 dark:border-gray-600'
                }`}>
                  <div className={`w-6 h-11 rounded-sm border-2 flex items-center justify-center transition-colors ${
                    selectedAspectRatio === '9:16'
                      ? 'border-violet-600 dark:border-violet-400 bg-violet-200/50 dark:bg-violet-800/50 text-violet-700 dark:text-violet-200'
                      : 'border-gray-400 dark:border-gray-500 bg-gray-200/40 dark:bg-gray-600/40 text-gray-500 dark:text-gray-300'
                  }`}>
                    <span className="text-[9px] font-bold tracking-tighter">9:16</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      Portrait (9:16)
                    </span>
                    {selectedAspectRatio === '9:16' && (
                      <span className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-400"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Format Vertikal untuk Shorts, Reels, dan TikTok.
                  </p>
                </div>
              </button>

              {/* Opsi 16:9 Landscape */}
              <button
                type="button"
                onClick={() => setSelectedAspectRatio('16:9')}
                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 ${
                  selectedAspectRatio === '16:9'
                    ? 'border-violet-600 bg-violet-50/80 dark:bg-violet-950/40 ring-2 ring-violet-500/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Visualizer Frame 16:9 (Lebar Horizontal) */}
                <div className={`w-14 h-16 rounded-lg flex items-center justify-center shrink-0 border-2 transition-colors ${
                  selectedAspectRatio === '16:9'
                    ? 'bg-violet-100 dark:bg-violet-900/60 border-violet-500'
                    : 'bg-gray-100 dark:bg-gray-700/60 border-gray-300 dark:border-gray-600'
                }`}>
                  <div className={`w-11 h-6 rounded-sm border-2 flex items-center justify-center transition-colors ${
                    selectedAspectRatio === '16:9'
                      ? 'border-violet-600 dark:border-violet-400 bg-violet-200/50 dark:bg-violet-800/50 text-violet-700 dark:text-violet-200'
                      : 'border-gray-400 dark:border-gray-500 bg-gray-200/40 dark:bg-gray-600/40 text-gray-500 dark:text-gray-300'
                  }`}>
                    <span className="text-[9px] font-bold tracking-tighter">16:9</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      Landscape (16:9)
                    </span>
                    {selectedAspectRatio === '16:9' && (
                      <span className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-400"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Format Horizontal untuk YouTube dan Layar Standar.
                  </p>
                </div>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Pilihan rasio aspek akan diterapkan secara otomatis untuk seluruh item video di dalam batch pengiriman ini.
            </p>
          </div>

          {/* Batch Cards */}
          <div className="space-y-4">
            {batch.map((entry, idx) => (
              <Card key={entry.id} className="p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Video #{idx + 1}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateBatchEntry(entry.id)}
                      className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                      title="Duplikat kartu"
                    >
                      Duplikat
                    </button>
                    {batch.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBatchEntry(entry.id)}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Prompt */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prompt Video *
                    </label>
                    <Textarea
                      placeholder={`Deskripsikan video #${idx + 1} yang ingin Anda buat...`}
                      rows={3}
                      value={entry.prompt}
                      onChange={(e) => updateBatchEntryPrompt(entry.id, e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  {/* Image Reference */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gambar Referensi (Opsional)
                    </label>
                    <div
                      onDragEnter={(e) => handleBatchFileDrop(entry.id, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleBatchFileDrop(entry.id, e)}
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                        entry.previewUrl
                          ? 'border-violet-300 bg-violet-50/50 dark:bg-violet-950/20'
                          : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                        input.onchange = (evt) => {
                          const target = evt.target as HTMLInputElement;
                          if (target.files && target.files[0]) {
                            handleBatchFileSelect(entry.id, target.files[0]);
                          }
                        };
                        input.click();
                      }}
                    >
                      {entry.previewUrl ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={entry.previewUrl}
                            alt="Preview referensi"
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                              Gambar referensi dipilih
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBatchEntryImage(entry.id);
                              }}
                              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400"
                            >
                              Hapus gambar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 rounded-full">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              Klik untuk memilih gambar referensi
                            </p>
                            <p className="text-xs text-gray-500">
                              Mendukung JPG, PNG, WEBP, GIF (Maks. 10MB)
                            </p>
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addBatchEntry}
              className="w-full py-3 border-dashed border-gray-300 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-600"
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Tambah Video</span>
              </div>
            </Button>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pilih Browser Account (Opsional)
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={selectedAccountId || ''}
              onChange={(e) =>
                setSelectedAccountId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                -- Otomatis (Rotasi System) --
              </option>
              {accounts.map((acc) => (
                <option
                  key={acc.id}
                  value={acc.id}
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {acc.name} ({acc.status})
                </option>
              ))}
            </select>
          </div>

          {/* Notice Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p>
              Batch {batch.length} pekerjaan video akan dimasukkan ke dalam antrean. Setiap kartu valid akan menghasilkan satu pekerjaan terpisah.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Masukkan Batch {batch.length} Pekerjaan ke Antrean
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}