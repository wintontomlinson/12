import { create } from 'zustand';

/**
 * Ephemeral UI state: which panels are open.
 *
 * Deliberately NOT persisted — reopening the app with a stale lyrics panel over
 * the content is worse than starting clean.
 */
interface UiState {
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isFullscreen: boolean;
  isSidebarOpen: boolean;

  toggleLyrics: () => void;
  toggleQueue: () => void;
  toggleFullscreen: () => void;
  setFullscreen: (open: boolean) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  isLyricsOpen: false,
  isQueueOpen: false,
  isFullscreen: false,
  isSidebarOpen: false,

  // Lyrics and queue share the same right-hand rail, so opening one closes the
  // other rather than stacking two panels.
  toggleLyrics: () =>
    set((state) => ({ isLyricsOpen: !state.isLyricsOpen, isQueueOpen: false })),
  toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen, isLyricsOpen: false })),

  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
  setFullscreen: (open) => set({ isFullscreen: open }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}));
