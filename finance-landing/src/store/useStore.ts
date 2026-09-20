import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Asset } from '../types';

interface AppState {
  theme: string;
  setTheme: (theme: string) => void;
  watchlist: Asset[];
  toggleWatchlist: (asset: Asset) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      watchlist: [],
      toggleWatchlist: (asset) =>
        set((state) => {
          const exists = state.watchlist.find((a) => a.ticker === asset.ticker);
          if (exists) {
            return { watchlist: state.watchlist.filter((a) => a.ticker !== asset.ticker) };
          }
          return { watchlist: [...state.watchlist, asset] };
        }),
    }),
    {
      name: 'finance-app-storage',
    }
  )
);
