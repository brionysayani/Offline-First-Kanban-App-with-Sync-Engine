import { create } from 'zustand';

type AppState = {
  isOnline: boolean;
  isSyncing: boolean;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  isSyncing: false,
  setOnline: (value) => set({ isOnline: value }),
  setSyncing: (value) => set({ isSyncing: value })
}));
