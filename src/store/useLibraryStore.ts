import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Song } from '@shared/types';

/**
 * Likes and recently-played history, persisted to localStorage.
 *
 * Full `Song` objects are stored rather than ids so "Liked Songs" and "Recently
 * played" render instantly on load with no network round trip — and keep working
 * if the upstream API is down.
 */

const RECENTLY_PLAYED_LIMIT = 30;

interface LibraryState {
  /** Newest first. */
  likedSongs: Song[];
  /** Newest first, capped. */
  recentlyPlayed: Song[];

  isLiked: (songId: string) => boolean;
  toggleLike: (song: Song) => void;
  recordPlay: (song: Song) => void;
  clearRecentlyPlayed: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      recentlyPlayed: [],

      isLiked: (songId) => get().likedSongs.some((song) => song.id === songId),

      toggleLike: (song) => {
        set((state) => {
          const exists = state.likedSongs.some((liked) => liked.id === song.id);
          return {
            likedSongs: exists
              ? state.likedSongs.filter((liked) => liked.id !== song.id)
              : [song, ...state.likedSongs],
          };
        });
      },

      recordPlay: (song) => {
        set((state) => ({
          // Dedupe by id so replaying a track moves it to the front rather than
          // filling the list with duplicates.
          recentlyPlayed: [
            song,
            ...state.recentlyPlayed.filter((entry) => entry.id !== song.id),
          ].slice(0, RECENTLY_PLAYED_LIMIT),
        }));
      },

      clearRecentlyPlayed: () => set({ recentlyPlayed: [] }),
    }),
    {
      name: 'sur:library',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        likedSongs: state.likedSongs,
        recentlyPlayed: state.recentlyPlayed,
      }),
    },
  ),
);
