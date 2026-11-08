import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { jobsApi } from '../lib/services';
import type { VideoJob } from '../types';
import { RefreshCw, Eye, XCircle } from 'lucide-react';
import { JobDetailModal } from '../components/JobDetailModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function JobList() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const { refreshInterval } = useSettings();
  
  // Detail modal state
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete modal state
  const [jobToDelete, setJobToDelete] = useState<VideoJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Cancel modal state
  const [jobToCancel, setJobToCancel] = useState<VideoJob | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await jobsApi.getAll();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Auto-refresh based on settings
  useEffect(() => {
    if (refreshInterval === 0) return;
    const timer = setInterval(fetchJobs, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(j => j.status === filter);

  const handleOpenDetail = (id: number) => {
    setSelectedJobId(id);
    setIsModalOpen(true);
  };

  // Status filter options based on actual VideoJob status types
  const statusFilterOptions = [
    { value: 'all', label: 'Semua Status' },
    { value: 'queued', label: 'Antrean' },
    { value: 'preparing', label: 'Persiapan' },
    { value: 'running', label: 'Berjalan' },
    { value: 'downloading', label: 'Mengunduh' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
    { value: 'paused', label: 'Dijeda' },
    { value: 'cancelled', label: 'Dibatalkan' },
    { value: 'awaiting_user', label: 'Menunggu Pengguna' },
  ];

  const handleCloseDetail = () => {
    setIsModalOpen(false);
    setSelectedJobId(null);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await jobsApi.delete(jobToDelete.id);
      setJobToDelete(null);
      await fetchJobs();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus tugas');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;

    try {
      setIsCancelling(true);
      await jobsApi.cancel(jobToCancel.id);
      setJobToCancel(null);
      await fetchJobs();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isJobDeletable = (status: string) => {
    const activeStatuses = ['queued', 'preparing', 'running', 'downloading', 'awaiting_user'];
    return !activeStatuses.includes(status);
  };

  const isJobCancellable = (status: string) => {
    const cancellableStatuses = ['queued', 'preparing', 'running', 'downloading', 'awaiting_user', 'paused'];
    return cancellableStatuses.includes(status);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Antrean & Riwayat</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola dan pantau status antrean pemrosesan serta riwayat video yang telah dibuat
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {deleteError}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Prompt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Dibuat</th>
                <th className="py-3 px-4">Selesai</th>
                <th className="py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredJobs.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Tidak ada data.</td></tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-mono text-gray-500 dark:text-gray-400">#{job.id}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-gray-900 dark:text-gray-100 font-medium">{job.prompt}</td>
                    <td className="py-3 px-4"><Badge status={job.status} /></td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{new Date(job.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{job.completed_at ? new Date(job.completed_at).toLocaleDateString() : '-'}</td>
                    <td className="py-3 px-4 flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         size="sm"
                         onClick={() => handleOpenDetail(job.id)}
                         className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5"
                       >
                         <Eye className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                         Detail
                       </Button>
                       {isJobCancellable(job.status) && (
                         <Button 
                           variant="ghost" 
                           size="sm"
                           onClick={() => setJobToCancel(job)}
                           className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 p-1.5"
                           title="Batalkan Pekerjaan"
                         >
                           <XCircle className="h-4 w-4" />
                         </Button>
                       )}
                       {isJobDeletable(job.status) && (
                         <Button 
                           variant="ghost" 
                           size="sm"
                           onClick={() => setJobToDelete(job)}
                           className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5"
                           title="Hapus Tugas"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <JobDetailModal
        jobId={selectedJobId}
        isOpen={isModalOpen}
        onClose={handleCloseDetail}
      />

      <ConfirmDialog
        isOpen={!!jobToDelete}
        title="Hapus Tugas?"
        message={
          jobToDelete ? (
            <div className="space-y-2">
              <p>Apakah Anda yakin ingin menghapus tugas ini secara permanen?</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-xs">
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">ID:</span> #{jobToDelete.id}</p>
                <p className="line-clamp-2 mt-1"><span className="font-semibold text-gray-700 dark:text-gray-300">Prompt:</span> {jobToDelete.prompt}</p>
              </div>
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                Peringatan: Data pekerjaan, log, dan referensi berkas terkait akan dihapus secara permanen.
              </p>
            </div>
          ) : ''
        }
        confirmLabel="Hapus Tugas"
        cancelLabel="Batal"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setJobToDelete(null)}
      />

      <ConfirmDialog
        isOpen={!!jobToCancel}
        title="Batalkan Pekerjaan?"
        message={
          jobToCancel ? (
            <div className="space-y-2">
              <p>Apakah Anda yakin ingin membatalkan pekerjaan ini?</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-xs">
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">ID:</span> #{jobToCancel.id}</p>
                <p className="line-clamp-2 mt-1"><span className="font-semibold text-gray-700 dark:text-gray-300">Prompt:</span> {jobToCancel.prompt}</p>
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
        onConfirm={handleConfirmCancel}
        onClose={() => setJobToCancel(null)}
      />
    </div>
  );
}
