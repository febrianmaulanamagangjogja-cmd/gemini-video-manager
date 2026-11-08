import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type RefreshInterval = 0 | 10 | 30 | 60;

export type RetryConfig = {
  autoRetry: boolean;
  maxRetries: 1 | 2 | 3 | 4 | 5;
  downloadTimeout: 5 | 10 | 30 | 60 | 120; // in seconds
  cacheCleanInterval: 30 | 60 | 180 | 360; // in minutes
  validateVideoIntegrity: boolean;
};

export type WebsiteConfig = {
  websiteName: string;
  websiteIcon: string;
};

interface SettingsContextValue {
  refreshInterval: RefreshInterval;
  setRefreshInterval: (value: RefreshInterval) => void;
  retryConfig: RetryConfig;
  setRetryConfig: (config: Partial<RetryConfig>) => void;
  websiteConfig: WebsiteConfig;
  setWebsiteConfig: (config: Partial<WebsiteConfig>) => void;
  isLoadingWebsiteConfig: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const STORAGE_KEY = 'gemini-manager-settings';

const getCurrentUserId = () => {
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      return user?.id;
    }
  } catch {
    return null;
  }
  return null;
};

const getUserStorageKey = () => {
  const userId = getCurrentUserId();
  return userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval>(() => {
    try {
      const key = getUserStorageKey();
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      return [0, 10, 30, 60].includes(stored.refreshInterval) ? stored.refreshInterval : 0;
    } catch {
      return 0;
    }
  });

  const setRefreshInterval = (value: RefreshInterval) => {
    setRefreshIntervalState(value);
    // Simpan ke storage spesifik user
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify({ refreshInterval: value, retryConfig: retryConfig }));
    }
  };

  // Add retryConfig state management
  const [retryConfig, setRetryConfigState] = useState<RetryConfig>(() => {
    try {
      const key = getUserStorageKey();
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        autoRetry: stored.retryConfig?.autoRetry ?? false,
        maxRetries: [1, 2, 3, 4, 5].includes(stored.retryConfig?.maxRetries) ? stored.retryConfig?.maxRetries : 3,
        downloadTimeout: [5, 10, 30, 60, 120].includes(stored.retryConfig?.downloadTimeout) ? stored.retryConfig?.downloadTimeout : 30,
        cacheCleanInterval: [30, 60, 180, 360].includes(stored.retryConfig?.cacheCleanInterval) ? stored.retryConfig?.cacheCleanInterval : 60,
        validateVideoIntegrity: stored.retryConfig?.validateVideoIntegrity ?? true,
      };
    } catch {
      return {
        autoRetry: false,
        maxRetries: 3,
        downloadTimeout: 30,
        cacheCleanInterval: 60,
        validateVideoIntegrity: true,
      };
    }
  });

  // Website config state (from backend + localStorage cache)
  const [websiteConfig, setWebsiteConfigState] = useState<WebsiteConfig>(() => {
    try {
      const key = getUserStorageKey();
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (stored.websiteConfig && stored.websiteConfig.websiteName) {
        return stored.websiteConfig;
      }
    } catch {}
    return {
      websiteName: 'Gemini Video Manager',
      websiteIcon: '',
    };
  });
  const [isLoadingWebsiteConfig, setIsLoadingWebsiteConfig] = useState(true);

  // Fetch website config from backend on mount
  useEffect(() => {
    const fetchWebsiteConfig = async () => {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json.success && json.data) {
          const cfg = {
            websiteName: json.data.websiteName || 'Gemini Video Manager',
            websiteIcon: json.data.websiteIcon || '',
          };
          setWebsiteConfigState(cfg);
          if (cfg.websiteName) {
            document.title = `${cfg.websiteName} - Video Studio`;
          }
          if (cfg.websiteIcon) {
            updateFavicon(cfg.websiteIcon);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch website config from backend:', err);
      } finally {
        setIsLoadingWebsiteConfig(false);
      }
    };
    fetchWebsiteConfig();
  }, []);

  const setWebsiteConfig = (config: Partial<WebsiteConfig>) => {
    setWebsiteConfigState((prev) => {
      const updated = { ...prev, ...config };
      if (updated.websiteName) {
        document.title = `${updated.websiteName} - Video Studio`;
      }
      if (updated.websiteIcon) {
        updateFavicon(updated.websiteIcon);
      } else if (config.websiteIcon === '') {
        updateFavicon('/favicon.ico');
      }
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, websiteConfig: updated }));
      } catch {}
      return updated;
    });
  };

  // Sinkronisasi awal dari backend ke frontend jika tersedia
  useEffect(() => {
    const fetchBackendSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setRetryConfigState({
            autoRetry: !!json.data.autoRetry,
            maxRetries: (json.data.maxRetries || 3) as any,
            downloadTimeout: (json.data.downloadTimeout || 30) as any,
            cacheCleanInterval: (json.data.cacheCleanInterval || 60) as any,
            validateVideoIntegrity: json.data.validateVideoIntegrity ?? true,
          });
        }
      } catch (err) {
        console.warn('Backend settings fetch fallback to localStorage:', err);
      }
    };
    fetchBackendSettings();
  }, []);

  const setRetryConfig = (partialConfig: Partial<RetryConfig>) => {
    setRetryConfigState((prev) => {
      const updated = { ...prev, ...partialConfig };
      const userId = getCurrentUserId();
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify({ refreshInterval, retryConfig: updated }));
      }
      return updated;
    });
  };

  // Hilangkan auto-sync simpan otomatis ke backend/localStorage global agar disimpan secara terisolasi saat user menekan Simpan Pengaturan
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify({ refreshInterval, retryConfig }));
    }
  }, [refreshInterval, retryConfig]);

  return (
    <SettingsContext.Provider value={{ refreshInterval, setRefreshInterval, retryConfig, setRetryConfig, websiteConfig, setWebsiteConfig, isLoadingWebsiteConfig }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings harus digunakan di dalam SettingsProvider');
  return context;
}

// Helper function to update favicon dynamically
function updateFavicon(iconUrl: string) {
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = iconUrl;
}
