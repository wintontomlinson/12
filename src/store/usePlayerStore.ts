import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AudioQuality, Song } from '@shared/types';
import { clamp, shuffled } from '@/lib/utils';

/**
 * The playback state machine.
 *
 * Holds only *intent* and *bookkeeping* — it never touches an audio element.
 * `usePlayer` observes this store and drives Howler to match. That split keeps
 * the queue logic synchronously testable and stops audio side effects from
 * leaking into component code.
 */

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Streaming quality the listener asked for.
 *
 * `auto` is the default and the reason this exists: a 320kbps track is 8–15 MB,
 * which stutters badly on a slow connection. `auto` starts from a connection
 * estimate and lets the engine downgrade further when it detects stalls.
 */
export type QualityPreference = 'auto' | '96kbps' | '160kbps' | '320kbps';

interface PlayerState {
  queue: Song[];
  queueIndex: number;

  /**
   * Pre-shuffle queue order, kept ONLY while shuffle is on.
   *
   * Without it, turning shuffle off would leave the queue permanently
   * scrambled instead of restoring the album/playlist order the user started
   * from (requirement R3.3).
   */
  originalQueue: Song[] | null;

  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  /** Playback position in seconds. Written many times per second by `usePlayer`. */
  position: number;
  /** Authoritative duration from the audio element; falls back to API metadata. */
  duration: number;

  status: PlaybackStatus;
  error: string | null;

  /** What the listener chose. Persisted. */
  qualityPreference: QualityPreference;
  /** What is actually streaming right now, after auto-selection and downgrades. */
  effectiveQuality: AudioQuality | null;
  /** True while playback has been reduced below the requested quality. */
  didAutoDowngrade: boolean;

  // ── intent ────────────────────────────────────────────────────────────────
  /** Replaces the queue with `songs` and starts at `startIndex`. */
  playQueue: (songs: Song[], startIndex?: number) => void;
  /** Plays a single track immediately, replacing the queue. */
  playSong: (song: Song) => void;
  /** Appends to the end of the queue. */
  addToQueue: (song: Song) => void;
  /** Inserts directly after the current track. */
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;

  // ── transport ─────────────────────────────────────────────────────────────
  next: (options?: { auto?: boolean }) => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;

  // ── modes ─────────────────────────────────────────────────────────────────
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // ── engine reporting (called by usePlayer) ────────────────────────────────
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setStatus: (status: PlaybackStatus, error?: string | null) => void;

  setQualityPreference: (preference: QualityPreference) => void;
  reportQuality: (quality: AudioQuality | null, didAutoDowngrade: boolean) => void;
}

/** Current track derived from queue + index, rather than duplicated in state. */
export function selectCurrentTrack(state: PlayerState): Song | null {
  return state.queue[state.queueIndex] ?? null;
}

export function selectHasNext(state: PlayerState): boolean {
  return state.repeat !== 'off' || state.queueIndex < state.queue.length - 1;
}

/** Position below which "previous" steps back instead of restarting (R3.2). */
export const RESTART_THRESHOLD_SECONDS = 3;

const QUALITY_PREFERENCES: readonly QualityPreference[] = ['auto', '96kbps', '160kbps', '320kbps'];

function isQualityPreference(value: unknown): value is QualityPreference {
  return typeof value === 'string' && QUALITY_PREFERENCES.includes(value as QualityPreference);
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      queueIndex: 0,
      originalQueue: null,
      isPlaying: false,
      volume: 0.8,
      isMuted: false,
      shuffle: false,
      repeat: 'off',
      position: 0,
      duration: 0,
      status: 'idle',
      error: null,
      qualityPreference: 'auto',
      effectiveQuality: null,
      didAutoDowngrade: false,

      playQueue: (songs, startIndex = 0) => {
        if (songs.length === 0) return;
        const index = clamp(startIndex, 0, songs.length - 1);

        // Starting a new context abandons any shuffle mapping from the old one.
        const { shuffle } = get();
        if (!shuffle) {
          set({
            queue: songs,
            queueIndex: index,
            originalQueue: null,
            position: 0,
            duration: 0,
            isPlaying: true,
            status: 'loading',
            error: null,
          });
          return;
        }

        // Shuffle is on: keep the chosen track first, randomise the rest, and
        // remember the true order so shuffle can be switched off later.
        const chosen = songs[index] as Song;
        const rest = songs.filter((_, i) => i !== index);
        set({
          queue: [chosen, ...shuffled(rest)],
          queueIndex: 0,
          originalQueue: songs,
          position: 0,
          duration: 0,
          isPlaying: true,
          status: 'loading',
          error: null,
        });
      },

      playSong: (song) => get().playQueue([song], 0),

      addToQueue: (song) => {
        set((state) => ({
          queue: [...state.queue, song],
          originalQueue: state.originalQueue ? [...state.originalQueue, song] : null,
        }));
      },

      playNext: (song) => {
        set((state) => {
          const queue = [...state.queue];
          queue.splice(state.queueIndex + 1, 0, song);
          return { queue };
        });
      },

      removeFromQueue: (index) => {
        set((state) => {
          if (index < 0 || index >= state.queue.length) return state;

          const queue = state.queue.filter((_, i) => i !== index);
          const removed = state.queue[index];
          const originalQueue = state.originalQueue
            ? state.originalQueue.filter((song) => song.id !== removed?.id)
            : null;

          // Removing something before the cursor would otherwise shift the
          // current track out from under the player.
          let queueIndex = state.queueIndex;
          if (index < state.queueIndex) queueIndex -= 1;

          if (queue.length === 0) {
            return { queue, originalQueue, queueIndex: 0, isPlaying: false, status: 'idle' as const };
          }
          return { queue, originalQueue, queueIndex: clamp(queueIndex, 0, queue.length - 1) };
        });
      },

      clearQueue: () =>
        set({
          queue: [],
          queueIndex: 0,
          originalQueue: null,
          isPlaying: false,
          position: 0,
          duration: 0,
          status: 'idle',
          error: null,
        }),

      next: ({ auto = false } = {}) => {
        const { queue, queueIndex, repeat } = get();
        if (queue.length === 0) return;

        const isLast = queueIndex >= queue.length - 1;

        if (!isLast) {
          set({ queueIndex: queueIndex + 1, position: 0, duration: 0, isPlaying: true, status: 'loading', error: null });
          return;
        }

        if (repeat === 'all') {
          set({ queueIndex: 0, position: 0, duration: 0, isPlaying: true, status: 'loading', error: null });
          return;
        }

        // End of queue with repeat off.
        if (auto) {
          // Reached naturally: stop and park at the end of the last track so the
          // UI shows a completed track rather than snapping back to 0:00.
          set({ isPlaying: false });
        } else {
          // Explicit click on the last track: restart it, matching Spotify.
          set({ position: 0, isPlaying: true });
        }
      },

      previous: () => {
        const { queueIndex, repeat, queue } = get();

        if (queueIndex > 0) {
          set({ queueIndex: queueIndex - 1, position: 0, duration: 0, isPlaying: true, status: 'loading', error: null });
          return;
        }
        if (repeat === 'all' && queue.length > 0) {
          set({ queueIndex: queue.length - 1, position: 0, duration: 0, isPlaying: true, status: 'loading', error: null });
          return;
        }
        // Already first: restart it.
        set({ position: 0 });
      },

      jumpTo: (index) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        set({
          queueIndex: index,
          position: 0,
          duration: 0,
          isPlaying: true,
          status: 'loading',
          error: null,
        });
      },

      togglePlay: () => {
        const { queue, isPlaying } = get();
        if (queue.length === 0) return;
        set({ isPlaying: !isPlaying });
      },

      setPlaying: (isPlaying) => set({ isPlaying }),

      setVolume: (volume) => {
        const next = clamp(volume, 0, 1);
        // Dragging the slider up from zero is an implicit unmute.
        set({ volume: next, isMuted: next === 0 ? get().isMuted : false });
      },

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      toggleShuffle: () => {
        const { shuffle, queue, queueIndex, originalQueue } = get();

        if (queue.length === 0) {
          set({ shuffle: !shuffle });
          return;
        }

        const current = queue[queueIndex] as Song;

        if (!shuffle) {
          // Turning ON: current track stays put at index 0, everything after is
          // randomised. Preserves what is playing (requirement R3.3).
          const rest = queue.filter((_, i) => i !== queueIndex);
          set({
            shuffle: true,
            originalQueue: queue,
            queue: [current, ...shuffled(rest)],
            queueIndex: 0,
          });
          return;
        }

        // Turning OFF: restore true order and re-point the cursor at whatever is
        // currently playing so audio continues uninterrupted.
        const restored = originalQueue ?? queue;
        const restoredIndex = restored.findIndex((song) => song.id === current.id);
        set({
          shuffle: false,
          queue: restored,
          queueIndex: restoredIndex >= 0 ? restoredIndex : 0,
          originalQueue: null,
        });
      },

      cycleRepeat: () => {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const current = order.indexOf(get().repeat);
        set({ repeat: order[(current + 1) % order.length] as RepeatMode });
      },

      setPosition: (position) => set({ position }),
      setDuration: (duration) => set({ duration }),
      setStatus: (status, error = null) => set({ status, error }),

      setQualityPreference: (qualityPreference) =>
        // Clearing the downgrade flag matters: an explicit choice should not keep
        // showing "reduced due to your connection" from a previous track.
        set({ qualityPreference, didAutoDowngrade: false }),

      reportQuality: (effectiveQuality, didAutoDowngrade) =>
        set({ effectiveQuality, didAutoDowngrade }),
    }),
    {
      name: 'sur:player',
      version: 1,
      storage: createJSONStorage(() => localStorage),

      /**
       * `isPlaying`, `status` and `error` are deliberately NOT persisted.
       *
       * Browsers block autoplay without a user gesture, so restoring
       * `isPlaying: true` would produce a UI that claims to be playing while
       * silent. Playback resumes paused at the saved position instead
       * (requirement R6.2).
       */
      partialize: (state) => ({
        queue: state.queue,
        queueIndex: state.queueIndex,
        originalQueue: state.originalQueue,
        volume: state.volume,
        isMuted: state.isMuted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        position: state.position,
        qualityPreference: state.qualityPreference,
      }),

      /**
       * Rehydration guard. Persisted state is attacker-adjacent (any script can
       * write localStorage) and schema-stale after a deploy, so anything
       * unexpected falls back to defaults rather than crashing the app
       * (requirement R6.3).
       */
      merge: (persisted, current) => {
        const saved = persisted as Partial<PlayerState> | undefined;
        if (!saved) return current;

        /**
         * Sanitize the queue rather than discarding EVERYTHING.
         *
         * This used to bail out and return defaults whenever `queue` was not an
         * array, which threw away perfectly good settings alongside it — volume,
         * repeat mode and the quality preference were all lost because of one bad
         * field. Each field is now validated on its own.
         */
        const queue = Array.isArray(saved.queue)
          ? saved.queue.filter(
              (song): song is Song =>
                typeof song === 'object' && song !== null && typeof (song as Song).id === 'string',
            )
          : [];

        return {
          ...current,
          ...saved,
          queue,
          queueIndex: clamp(saved.queueIndex ?? 0, 0, Math.max(queue.length - 1, 0)),
          originalQueue: Array.isArray(saved.originalQueue) ? saved.originalQueue : null,
          volume: clamp(typeof saved.volume === 'number' ? saved.volume : 0.8, 0, 1),
          position: typeof saved.position === 'number' && saved.position >= 0 ? saved.position : 0,
          qualityPreference: isQualityPreference(saved.qualityPreference)
            ? saved.qualityPreference
            : 'auto',
          // Always start paused and idle regardless of what was written.
          isPlaying: false,
          status: 'idle',
          error: null,
          duration: 0,
          // Re-derived per track by the engine, never restored.
          effectiveQuality: null,
          didAutoDowngrade: false,
        };
      },
    },
  ),
);
