import { useState } from 'react';
import { cn } from '../../utils/cn';
import { Menu, X, Sun, Moon, LogOut, User, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
}

export function Header({ onMenuClick, isSidebarCollapsed }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { websiteConfig } = useSettings();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      addToast({ message: 'Berhasil keluar dari akun', type: 'success' });
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 right-0 z-30 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 transition-all duration-300 left-0 w-full',
          isSidebarCollapsed ? 'lg:left-16 lg:w-[calc(100%-4rem)]' : 'lg:left-64 lg:w-[calc(100%-16rem)]'
        )}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Buka menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2.5">
            {websiteConfig.websiteIcon && (
              <img
                src={websiteConfig.websiteIcon}
                alt={websiteConfig.websiteName}
                className="w-7 h-7 object-contain rounded-lg"
              />
            )}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hidden sm:block">
              {websiteConfig.websiteName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-amber-400 hover:text-amber-300 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="h-5 w-5 text-gray-600 hover:text-gray-900 transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>

          {/* User Profile Dropdown */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
              >
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-medium text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
                  {user.username}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-1 z-50">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Profil
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      handleLogoutClick();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Sidebar Toggle */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Tutup menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Logout Confirmation Dialog - rendered at root level to avoid header stacking context issues */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Keluar dari akun?"
        message="Apakah kamu yakin ingin keluar dari Gemini Video Manager?"
        confirmLabel="Ya, Logout"
        cancelLabel="Batal"
        variant="danger"
      />
    </>
  );
}