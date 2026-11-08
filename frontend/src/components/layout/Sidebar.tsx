import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard,
  PlusCircle,
  ListChecks,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Video,
  Sparkles,
  Shield,
  History,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Buat Video', href: '/create', icon: PlusCircle },
  { name: 'Antrean & Riwayat', href: '/jobs', icon: ListChecks },
  { name: 'Kelola Akun', href: '/accounts', icon: Users },
  { name: 'Pengaturan', href: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const { setActiveTab } = useAppStore();
  const { user } = useAuth();
  const { websiteConfig } = useSettings();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-r border-gray-200/80 dark:border-gray-800/80 transition-all duration-300 shadow-sm dark:shadow-gray-950/20',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn('flex h-16 items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800/60')}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 overflow-hidden">
                {websiteConfig.websiteIcon ? (
                  <img src={websiteConfig.websiteIcon} alt={websiteConfig.websiteName} className="w-full h-full object-contain" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 dark:from-violet-400 dark:to-indigo-300 bg-clip-text text-transparent leading-tight">
                  {websiteConfig.websiteName}
                </span>
                <span className="text-[10px] font-medium text-gray-400 tracking-wider uppercase">
                  Video Studio
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 overflow-hidden">
              {websiteConfig.websiteIcon ? (
                <img src={websiteConfig.websiteIcon} alt={websiteConfig.websiteName} className="w-full h-full object-contain" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </div>
          )}
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              'p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors',
              collapsed && 'hidden'
            )}
            aria-label={collapsed ? 'Perluas sidebar' : 'Lipat sidebar'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-600 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className={cn(
                  'h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105',
                  isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                )} aria-hidden="true" />
                {!collapsed && (
                  <span className="whitespace-nowrap font-medium">{item.name}</span>
                )}
              </NavLink>
            );
          })}

          {user?.role === 'admin' && (
            <>
              {collapsed ? (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
                  <NavLink
                    to="/admin/dashboard"
                    className={cn(
                      'relative flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/dashboard'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                    title="Dashboard Admin"
                  >
                    <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                  <NavLink
                    to="/admin/users"
                    className={cn(
                      'relative flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/users'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                    title="Manajemen Pengguna"
                  >
                    <Users className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                  <NavLink
                    to="/admin/audit-logs"
                    className={cn(
                      'relative flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/audit-logs'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                    title="Audit Logs"
                  >
                    <History className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                  <NavLink
                    to="/admin/system-settings"
                    className={cn(
                      'relative flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/system-settings'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                    title="Pengaturan Sistem"
                  >
                    <Settings className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                </>
              ) : (
                <div className="pt-4 space-y-1">
                  <div className="px-3 pb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 border-t border-gray-100 dark:border-gray-800/80 pt-3">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Panel Administrator</span>
                  </div>

                  <NavLink
                    to="/admin/dashboard"
                    className={cn(
                      'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/dashboard'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-600 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                    )}
                  >
                    <LayoutDashboard className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    <span className="whitespace-nowrap font-medium">Dashboard Admin</span>
                  </NavLink>

                  <NavLink
                    to="/admin/users"
                    className={cn(
                      'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/users'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-600 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                    )}
                  >
                    <Users className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    <span className="whitespace-nowrap font-medium">Manajemen Pengguna</span>
                  </NavLink>

                  <NavLink
                    to="/admin/audit-logs"
                    className={cn(
                      'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/audit-logs'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-600 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                    )}
                  >
                    <History className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    <span className="whitespace-nowrap font-medium">Audit Logs</span>
                  </NavLink>

                  <NavLink
                    to="/admin/system-settings"
                    className={cn(
                      'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                      location.pathname === '/admin/system-settings'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-600 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                    )}
                  >
                    <Settings className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    <span className="whitespace-nowrap font-medium">Pengaturan Sistem</span>
                  </NavLink>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Collapse toggle at bottom when collapsed */}
        {collapsed && (
          <div className="p-2 text-center border-t border-gray-100 dark:border-gray-800/60">
            <button
              onClick={() => onCollapsedChange(false)}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              title="Perluas sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 mx-3 mb-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100/50 dark:border-violet-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>Version 1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}