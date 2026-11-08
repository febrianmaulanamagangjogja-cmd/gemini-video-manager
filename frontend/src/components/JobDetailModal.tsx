import { useEffect, useState } from 'react';
import { 
  Download, FileVideo, FolderOpen, X, AlertCircle, FileText, User, Upload, 
  CheckCircle, Eye, XCircle, Info, ChevronDown, ChevronRight, Clock, AlertTriangle,
  FilePlus, Play, Type, Send, ArrowLeft, Search, Image, Keyboard, Zap, UserCheck
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { jobsApi } from '../lib/services';
import type { VideoJob } from '../types';
import { useToast } from '../context/ToastContext';
import { logMessage } from '../lib/logMessage';
import { translateErrorMessage } from '../lib/errorMessage';
import { ImagePreviewModal } from './ImagePreviewModal';

interface JobDetailModalProps {
  jobId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: () => void;
}

export function JobDetailModal({ jobId, isOpen, onClose, onJobUpdated }: JobDetailModalProps) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);

  // Cancel state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [expandedTechLogIds, setExpandedTechLogIds] = useState<Set<number>>(new Set());
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobDetail(jobId);
    } else {
      setJob(null);
      setError(null);
      resetUploadState();
    }
  }, [isOpen, jobId]);

  const resetUploadState = () => {
    setUploadFile(null);
    setIsUploading(false);
    setUploadError(null);
    setUploadSuccess(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file format (MP4, WEBM, MOV)
      const allowedExt = ['.mp4', '.webm', '.mov'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExt.includes(ext) && !file.type.startsWith('video/')) {
        setUploadError('Hanya file video yang diizinkan (.mp4, .webm, .mov)');
        setUploadFile(null);
        return;
      }

      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        setUploadError('Ukuran file melebihi batas maksimal 100MB');
        setUploadFile(null);
        return;
      }

      if (file.size === 0) {
        setUploadError('File video tidak boleh kosong (0 bytes)');
        setUploadFile(null);
        return;
      }

      setUploadFile(file);
      setUploadError(null);
    } else {
      setUploadFile(null);
    }
  };

  const fetchJobDetail = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await jobsApi.getById(id);
      setJob(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail pekerjaan.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !uploadFile) return;

    if (job.status !== 'awaiting_user' && job.status !== 'running') {
      setUploadError('Pekerjaan ini tidak dalam status menunggu hasil video dari pengguna.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);

      await jobsApi.uploadVideo(job.id, uploadFile);

      setUploadSuccess(true);
      addToast({ type: 'success', message: 'Video berhasil diunggah dan pekerjaan diselesaikan.', duration: 3000 });
      resetUploadState();
      // Reload job detail to reflect completed status
      await fetchJobDetail(job.id);
      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat mengunggah video.');
      addToast({
        type: 'error',
        message: 'Gagal mengunggah video: ' + (err.response?.data?.error || err.message),
        duration: 5000
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!job) return;
    try {
      setIsCancelling(true);
      await jobsApi.cancel(job.id);
      addToast({
        type: 'success',
        message: `Pekerjaan #${job.id} berhasil dibatalkan.`,
        duration: 3000
      });
      setIsCancelConfirmOpen(false);
      await fetchJobDetail(job.id);
      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: 'Gagal membatalkan pekerjaan: ' + (err.response?.data?.error || err.message),
        duration: 5000
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const isJobCancellable = (status: string) => {
    const cancellableStatuses = ['queued', 'preparing', 'running', 'downloading', 'awaiting_user', 'paused'];
    return cancellableStatuses.includes(status);
  };

  const handleClose = () => {
    resetUploadState();
    onClose();
  };

  if (!isOpen) return null;

  const isAwaitingResult = job && (job.status === 'awaiting_user' || job.status === 'running');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Detail Pekerjaan #{jobId}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Informasi lengkap, status, dan riwayat eksekusi
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-full h-8 w-8 p-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
              <p className="text-sm">Memuat detail pekerjaan...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : job ? (
            <>
              {/* Status & Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Status Pekerjaan</span>
                  <div className="flex items-center gap-2">
                    <Badge status={job.status} />
                    <span className="text-xs text-gray-500 font-mono">Progress: {job.progress}%</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Akun Browser</span>
                  <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 font-medium">
                    <User className="h-4 w-4 text-violet-500" />
                    {job.account_id ? `Akun ID #${job.account_id}` : 'Otomatis (Rotasi System)'}
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt Video</label>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 text-sm whitespace-pre-wrap font-sans">
                  {job.prompt}
                </div>
              </div>

              {/* Status Menunggu Hasil Video Banner */}
              {isAwaitingResult && (
                <div className="p-4 bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300 font-semibold text-sm">
                    <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    <span>Pekerjaan Sedang Menunggu Hasil Video</span>
                  </div>
                  <p className="text-xs text-violet-700 dark:text-violet-300/80 leading-relaxed">
                    Browser worker telah membuka sesi Gemini Web dan memasukkan prompt. Silakan periksa browser, generate video secara manual, download hasilnya ke komputer Anda, lalu unggah file video tersebut di bawah untuk menyelesaikan pekerjaan.
                  </p>
                </div>
              )}

              {/* Form Upload Hasil Video (Hanya Tampil Jika Awaiting User / Running) */}
              {isAwaitingResult && (
                <div className="p-5 bg-white dark:bg-gray-800 border-2 border-dashed border-violet-300 dark:border-violet-700/60 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Upload Video Hasil Generasi Gemini
                    </h4>
                  </div>

                  <form onSubmit={handleUploadSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Pilih File Video (.mp4, .webm, .mov — Maks. 100MB)
                      </label>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-950 dark:file:text-violet-300 cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg p-1.5"
                      />
                    </div>

                    {uploadFile && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileVideo className="h-4 w-4 text-violet-500 flex-shrink-0" />
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{uploadFile.name}</span>
                        </div>
                        <span className="text-gray-500 font-mono flex-shrink-0 ml-2">{formatFileSize(uploadFile.size)}</span>
                      </div>
                    )}

                    {uploadError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {uploadSuccess && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>File video berhasil diunggah dan pekerjaan telah diselesaikan!</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={!uploadFile || isUploading}
                      className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Mengunggah dan Menyimpan Video...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span>Simpan Hasil Video & Selesaikan Pekerjaan</span>
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Reference Image & Output Video Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Gambar Referensi</span>
                  {job.reference_image_path ? (
                    <>
                      <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{job.reference_image_path}</p>
                      <div className="pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsImagePreviewOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat Gambar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">Tidak ada gambar referensi</p>
                  )}
                </div>

                {job.output_video_path && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Hasil Video Sungguhan</span>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{job.output_video_path}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await jobsApi.downloadVideo(job.id);
                            addToast({
                              type: 'success',
                              message: 'Pengunduhan video dimulai...',
                              duration: 3000,
                            });
                          } catch (e: any) {
                            addToast({
                              type: 'error',
                              message: 'Gagal mengunduh video: ' + (e.response?.data?.error || e.message),
                              duration: 5000,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh Hasil Video
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await jobsApi.openFolder(job.id);
                            addToast({
                              type: 'info',
                              message: 'Membuka folder penyimpanan video...',
                              duration: 3000,
                            });
                          } catch (e: any) {
                            addToast({
                              type: 'error',
                              message: 'Gagal membuka folder: ' + (e.response?.data?.error || e.message),
                              duration: 5000,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Buka di Folder
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pesan error hanya ditampilkan jika status pekerjaan tidak completed */}
              {job.error_message && job.status !== 'completed' && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Pesan Kesalahan
                  </span>
                  <p className="text-sm text-rose-800 dark:text-rose-300">{translateErrorMessage(job.error_message)}</p>
                </div>
              )}

              {/* Timeline / Timestamps */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">Waktu Eksekusi</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block">Dibuat</span>
                    <span className="text-gray-900 dark:text-gray-200 font-medium">{new Date(job.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Mulai</span>
                    <span className="text-gray-900 dark:text-gray-200 font-medium">{job.started_at ? new Date(job.started_at).toLocaleString('id-ID') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Selesai</span>
                    <span className="text-gray-900 dark:text-gray-200 font-medium">{job.completed_at ? new Date(job.completed_at).toLocaleString('id-ID') : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Job Logs */}
              {job.logs && job.logs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Riwayat Log</label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{job.logs.length} entri</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {job.logs
                      .slice()
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((log) => {
                        const friendly = logMessage(log.event);
                        const time = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        const showTech = expandedTechLogIds.has(log.id);
                        return (
                          <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-medium">
                              {friendly.icon === 'FilePlus' ? <FilePlus className="h-4 w-4" /> :
                               friendly.icon === 'Clock' ? <Clock className="h-4 w-4" /> :
                               friendly.icon === 'Play' ? <Play className="h-4 w-4" /> :
                               friendly.icon === 'Type' ? <Type className="h-4 w-4" /> :
                               friendly.icon === 'Send' ? <Send className="h-4 w-4" /> :
                               friendly.icon === 'User' ? <User className="h-4 w-4" /> :
                               friendly.icon === 'Download' ? <Download className="h-4 w-4" /> :
                               friendly.icon === 'Upload' ? <Upload className="h-4 w-4" /> :
                               friendly.icon === 'CheckCircle' ? <CheckCircle className="h-4 w-4" /> :
                               friendly.icon === 'AlertCircle' ? <AlertCircle className="h-4 w-4" /> :
                               friendly.icon === 'XCircle' ? <XCircle className="h-4 w-4" /> :
                               friendly.icon === 'ArrowLeft' ? <ArrowLeft className="h-4 w-4" /> :
                               friendly.icon === 'Search' ? <Search className="h-4 w-4" /> :
                               friendly.icon === 'Image' ? <Image className="h-4 w-4" /> :
                               friendly.icon === 'Keyboard' ? <Keyboard className="h-4 w-4" /> :
                               friendly.icon === 'Zap' ? <Zap className="h-4 w-4" /> :
                               friendly.icon === 'UserCheck' ? <UserCheck className="h-4 w-4" /> :
                               friendly.icon === 'AlertTriangle' ? <AlertTriangle className="h-4 w-4" /> :
                               <Info className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 dark:text-gray-500">{time}</span>
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{friendly.title}</span>
                                {log.level === 'error' && <span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 rounded">Gagal</span>}
                                {log.level === 'warning' && <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Peringatan</span>}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 break-words">{friendly.description}</p>
                              <button
                                onClick={() => setExpandedTechLogIds(prev => prev.has(log.id) ? new Set([...prev].filter(id => id !== log.id)) : new Set([...prev, log.id]))}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-flex items-center gap-1"
                              >
                                {showTech ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {showTech ? 'Sembunyikan Detail Teknis' : 'Tampilkan Detail Teknis'}
                              </button>
                              {showTech && (
                                <div className="mt-2 p-2.5 bg-gray-900 rounded-lg border border-gray-800 text-xs text-gray-300 font-mono overflow-x-auto max-w-full space-y-1">
                                  <div className="text-gray-500">// Informasi Teknis Internal</div>
                                  <div><span className="text-blue-400">Event:</span> {log.event}</div>
                                  <div><span className="text-blue-400">Level:</span> {log.level}</div>
                                  <div><span className="text-blue-400">Pesan Mentah:</span> {log.message}</div>
                                  <div><span className="text-blue-400">Timestamp:</span> {log.created_at}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              <ImagePreviewModal
                isOpen={isImagePreviewOpen}
                onClose={() => setIsImagePreviewOpen(false)}
                imageUrl={jobsApi.getReferenceImageUrl(job.id)}
              />
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            {job && isJobCancellable(job.status) && (
              <Button
                variant="outline"
                onClick={() => setIsCancelConfirmOpen(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30 dark:text-red-400 flex items-center gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Batalkan Pekerjaan
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Tutup
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        title="Batalkan Pekerjaan?"
        message={
          job ? (
            <div className="space-y-2">
              <p>Apakah Anda yakin ingin membatalkan pekerjaan ini?</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-xs">
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">ID:</span> #{job.id}</p>
                <p className="line-clamp-2 mt-1"><span className="font-semibold text-gray-700 dark:text-gray-300">Prompt:</span> {job.prompt}</p>
              </div>
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-2">
                Pekerjaan akan dihentikan. File video dan riwayat yang sudah tersimpan tidak akan dihapus.
              </p>
            </div>
          ) : ''
        }
        confirmLabel="Batalkan Pekerjaan"
        cancelLabel="Batal"
        variant="danger"
        isLoading={isCancelling}
        onConfirm={handleCancelJob}
        onClose={() => setIsCancelConfirmOpen(false)}
      />
    </div>
  );
}
