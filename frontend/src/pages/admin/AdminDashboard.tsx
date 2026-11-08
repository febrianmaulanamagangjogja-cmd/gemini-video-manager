import { useState, useEffect } from 'react';
import { adminApi, type AdminDashboardStats } from '../../lib/adminServices';
import {
  ListVideo,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Activity,
  Server,
  Database,
  RefreshCw,
  Users,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Shield,
  UserCog,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { translateAction, translateDetails, getActionColor } from '../../utils/auditLogHelpers';

const actionIcons: Record<string, React.ElementType> = {
  CREATE_USER: UserPlus,
  UPDATE_USER: Edit,
  DELETE_USER: Trash2,
  RESET_PASSWORD: Key,
  TOGGLE_ACTIVE: Shield,
  TOGGLE_ROLE: UserCog,
};

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      addToast({ message: err.message || 'Gagal memuat statistik admin', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Administrator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ringkasan pengguna, status pekerjaan, dan audit sistem
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Statistik Pengguna */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status Sistem & DB
              </p>
              <h3 className="text-base font-bold text-green-600 dark:text-green-400 mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                Operasional Normal
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800/60 pt-3">
            <span className="flex items-center gap-1"><Server className="w-3.5 h-3.5" /> Express Backend</span>
            <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> MySQL Active</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Akun Pengguna
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats?.totalUsers ?? '-'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800/60 pt-3">
            <span>User Biasa: <strong>{stats?.userCount ?? 0}</strong></span>
            <span>Admin: <strong>{stats?.adminCount ?? 0}</strong></span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Video Berhasil Selesai
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats?.jobStats.completed ?? '-'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800/60 pt-3">
            Total seluruh video yang selesai diunduh
          </div>
        </div>
      </div>

      {/* Ringkasan Job */}
      <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ListVideo className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          Status Seluruh Antrean & Pembuatan Video
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
              <Clock className="w-4 h-4" />
              Menunggu (Queued)
            </div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1">
              {stats?.jobStats.queued ?? 0}
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-medium">
              <Activity className="w-4 h-4 animate-pulse" />
              Sedang Berjalan
            </div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-1">
              {stats?.jobStats.running ?? 0}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Selesai
            </div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
              {stats?.jobStats.completed ?? 0}
            </div>
          </div>

          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-medium">
              <XCircle className="w-4 h-4" />
              Gagal
            </div>
            <div className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-1">
              {stats?.jobStats.failed ?? 0}
            </div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/40 rounded-xl">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4" />
              Dibatalkan
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-200 mt-1">
              {stats?.jobStats.cancelled ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Log Aktivitas Terbaru */}
      <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          Aktivitas Administrasi Terbaru
        </h2>
        {stats?.recentActivities && stats.recentActivities.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {stats.recentActivities.map((log) => {
              const ActionIcon = actionIcons[log.action] || Activity;
              return (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        <ActionIcon className="w-3.5 h-3.5 mr-1" />
                        {translateAction(log.action)}
                      </span>
                      <span className="text-xs text-gray-400">
                        Oleh User ID: {log.actor_id}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {translateDetails(log.action, log.details)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
            Belum ada catatan aktivitas admin.
          </p>
        )}
      </div>
    </div>
  );
}