import { create } from 'zustand';

interface AppStore {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab: string) => set({ activeTab: tab }),
}));
