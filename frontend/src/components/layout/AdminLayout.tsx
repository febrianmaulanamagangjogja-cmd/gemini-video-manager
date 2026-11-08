import { Outlet, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  History,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="flex">
        {/* Sidebar admin */}
        <aside className="w-64 bg-white dark:bg-gray-900 h-screen border-r border-gray-200/80 dark:border-gray-800/80 flex flex-col">
          <div className="p-4 border-b border-gray-200/80 dark:border-gray-800/60 flex items-center gap-2">
            <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            <div>
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 leading-tight">
                Admin Panel
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Selamat datang, {user?.username}
              </p>
            </div>
          </div>

          <nav className="flex-1 py-3 px-3 space-y-1">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white dark:bg-violet-600 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white dark:bg-violet-600 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              <Users className="h-5 w-5 flex-shrink-0" />
              Kelola Pengguna
            </NavLink>
            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white dark:bg-violet-600 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              <History className="h-5 w-5 flex-shrink-0" />
              Audit Log
            </NavLink>
          </nav>

          <div className="p-3 border-t border-gray-200/80 dark:border-gray-800/60">
            <NavLink
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Aplikasi
            </NavLink>
          </div>
        </aside>

        {/* Konten utama */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}