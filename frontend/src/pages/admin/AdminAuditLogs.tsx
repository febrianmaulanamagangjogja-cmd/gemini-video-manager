import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/adminServices';
import { RefreshCw, UserPlus, Edit, Trash2, Key, Shield, UserCog, Activity } from 'lucide-react';
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

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      addToast({ message: err.message || 'Gagal memuat log audit', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Log Aktivitas (Audit Logs)
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Catatan riwayat aktivitas administratif pengguna dan sistem
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Memuat log...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Tidak ada log ditemukan.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => {
                const ActionIcon = actionIcons[log.action] || Activity;
                return (
                <div key={log.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 flex gap-4">
                  <div className="mt-1">
                    <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                      <ActionIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                          {translateAction(log.action)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Pelaku: {log.actor_username ? `@${log.actor_username}` : `User ID #${log.actor_id}`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {translateDetails(log.action, log.details, log.target_username)}
                    </p>
                    {log.target_id && (
                      <div className="text-xs text-gray-400">
                        Target Pengguna: {log.target_username ? `@${log.target_username} (ID #${log.target_id})` : `ID #${log.target_id}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}