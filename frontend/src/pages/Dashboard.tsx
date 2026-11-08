import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { jobsApi, accountsApi } from '../lib/services';
import type { VideoJob, GeminiAccount } from '../types';
import { Film, CheckCircle, Clock, PlayCircle, XCircle, Users, Plus, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [accounts, setAccounts] = useState<GeminiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [jobsData, accountsData] = await Promise.all([
        jobsApi.getAll({ limit: 5 }),
        accountsApi.getAll(),
      ]);
      setJobs(jobsData);
      setAccounts(accountsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const queuedJobs = jobs.filter((j) => j.status === 'queued').length;
  const runningJobs = jobs.filter((j) => ['preparing', 'running', 'downloading'].includes(j.status)).length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const totalAccounts = accounts.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ringkasan aktivitas dan status sistem Gemini Video Manager
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>
          <Link to="/create">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Buat Video Baru
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pekerjaan</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalJobs}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Video Selesai</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedJobs}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dalam Antrean</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{queuedJobs}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <PlayCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sedang Diproses</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{runningJobs}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pekerjaan Gagal</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failedJobs}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Browser Profile</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalAccounts}</h4>
          </div>
        </Card>
      </div>

      {/* Recent Jobs Table */}
      <Card
        title="Pekerjaan Terbaru"
        description="Daftar antrean dan riwayat pembuatan video terakhir"
        action={
          <Link to="/jobs">
            <Button variant="ghost" size="sm">
              Lihat Semua
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Prompt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Memuat data pekerjaan...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Belum ada pekerjaan video yang dibuat.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-mono text-gray-500">#{job.id}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {job.prompt}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={job.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-violet-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {new Date(job.created_at).toLocaleString('id-ID')}
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
