import { useEffect } from 'react';
import { usePlayerControls } from '@/hooks/usePlayer';
import { useSwipe } from '@/hooks/useSwipe';
import { selectCurrentTrack, selectHasNext, usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useUiStore } from '@/store/useUiStore';
import { cn } from '@/lib/utils';
import { Equalizer } from './Equalizer';
import { MarqueeText } from './MarqueeText';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import {
  ChevronDownIcon,
  HeartIcon,
  LyricsIcon,
  MusicNoteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from '@/components/ui/icons';

/**
 * Fullscreen "now playing" view (requirement L4, mobile).
 *
 * Opened by swiping up on the mobile player bar or via the desktop fullscreen
 * button; dismissed by swiping down, Escape, or the chevron.
 *
 * This is an overlay rather than a route: navigating would unmount the player
 * bar and, more importantly, a route change should not be part of "expand the
 * thing I'm listening to". It also means Back does not close it, which is why
 * Escape and the swipe are wired up explicitly.
 */
export function FullscreenPlayer(): JSX.Element | null {
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const setFullscreen = useUiStore((s) => s.setFullscreen);
  const toggleLyrics = useUiStore((s) => s.toggleLyrics);
  const toggleQueue = useUiStore((s) => s.toggleQueue);

  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const hasNext = usePlayerStore(selectHasNext);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const { previousOrRestart } = usePlayerControls();

  const isLiked = useLibraryStore((s) =>
    currentTrack ? s.likedSongs.some((song) => song.id === currentTrack.id) : false,
  );
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const swipe = useSwipe({ onSwipeDown: () => setFullscreen(false) });

  // Escape closes it. Registered only while open so it cannot swallow Escape
  // from other components (the search box also listens for it).
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, setFullscreen]);

  if (!isFullscreen || !currentTrack) return null;

  const RepeatGlyph = repeat === 'one' ? RepeatOneIcon : RepeatIcon;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#2a2a2a] via-base to-black px-6 pb-8 pt-4"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      {...swipe}
    >
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          aria-label="Close fullscreen player"
          className="focus-ring rounded p-2 text-white"
        >
          <ChevronDownIcon className="h-6 w-6" />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Now playing
        </p>
        <Equalizer barCount={5} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <div className="aspect-square w-full max-w-[min(78vw,420px)] overflow-hidden rounded-card bg-surface shadow-2xl shadow-black/70">
          {currentTrack.image ? (
            <img src={currentTrack.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              <MusicNoteIcon className="h-20 w-20" />
            </div>
          )}
        </div>

        <div className="flex w-full max-w-md items-center gap-4">
          <div className="min-w-0 flex-1">
            <MarqueeText
              text={currentTrack.title}
              className="text-xl font-bold text-white sm:text-2xl"
            />
            <p className="mt-1 truncate text-sm text-muted">{currentTrack.artistNames}</p>
          </div>

          <button
            type="button"
            onClick={() => toggleLike(currentTrack)}
            aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            aria-pressed={isLiked}
            className={cn(
              'focus-ring shrink-0 rounded p-2 transition-colors',
              isLiked ? 'text-accent' : 'text-muted hover:text-white',
            )}
          >
            <HeartIcon filled={isLiked} className="h-6 w-6" />
          </button>
        </div>

        <div className="w-full max-w-md">
          {/* Always shown here, unlike the condensed mobile bar. */}
          <SeekBar />
        </div>

        <div className="flex w-full max-w-md items-center justify-between">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={cn(
              'focus-ring rounded p-2 transition-colors',
              shuffle ? 'text-accent' : 'text-muted hover:text-white',
            )}
          >
            <ShuffleIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={previousOrRestart}
            aria-label="Previous track"
            className="focus-ring rounded p-2 text-white"
          >
            <PreviousIcon className="h-7 w-7" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="ml-1 h-7 w-7" />}
          </button>

          <button
            type="button"
            onClick={() => next()}
            disabled={!hasNext}
            aria-label="Next track"
            className="focus-ring rounded p-2 text-white disabled:opacity-40"
          >
            <NextIcon className="h-7 w-7" />
          </button>

          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={`Repeat: ${repeat}`}
            className={cn(
              'focus-ring rounded p-2 transition-colors',
              repeat !== 'off' ? 'text-accent' : 'text-muted hover:text-white',
            )}
          >
            <RepeatGlyph className="h-5 w-5" />
          </button>
        </div>

        <div className="flex w-full max-w-md items-center justify-between">
          <button
            type="button"
            onClick={() => {
              // Panels live in the main layout, so the overlay must step aside.
              setFullscreen(false);
              toggleLyrics();
            }}
            className="focus-ring flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold text-muted hover:text-white"
          >
            <LyricsIcon className="h-4 w-4" /> Lyrics
          </button>

          <VolumeControl className="hidden sm:flex" />

          <button
            type="button"
            onClick={() => {
              setFullscreen(false);
              toggleQueue();
            }}
            className="focus-ring flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold text-muted hover:text-white"
          >
            <QueueIcon className="h-4 w-4" /> Queue
          </button>
        </div>
      </div>
    </div>
  );
}
