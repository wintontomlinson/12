import { Link } from 'react-router-dom';
import { usePlayerControls } from '@/hooks/usePlayer';
import {
  selectCurrentTrack,
  selectHasNext,
  usePlayerStore,
} from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useUiStore } from '@/store/useUiStore';
import { cn } from '@/lib/utils';
import { Equalizer } from './Equalizer';
import { MarqueeText } from './MarqueeText';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import {
  AlertIcon,
  ChevronDownIcon,
  FullscreenIcon,
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
 * The fixed bottom player bar.
 *
 * Three regions per the layout spec: metadata + like on the left, transport +
 * seek in the centre, secondary controls on the right.
 *
 * Every subscription is a narrow selector. `position` changes ~60x/second, so a
 * broad `usePlayerStore()` subscription here would re-render the artwork and
 * every button on every frame; instead only `SeekBar` observes it.
 */
export function PlayerBar(): JSX.Element {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const status = usePlayerStore((s) => s.status);
  const error = usePlayerStore((s) => s.error);
  const hasNext = usePlayerStore(selectHasNext);
  const hasQueue = usePlayerStore((s) => s.queue.length > 0);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const { previousOrRestart } = usePlayerControls();

  const isLiked = useLibraryStore((s) =>
    currentTrack ? s.likedSongs.some((song) => song.id === currentTrack.id) : false,
  );
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const isLyricsOpen = useUiStore((s) => s.isLyricsOpen);
  const isQueueOpen = useUiStore((s) => s.isQueueOpen);
  const toggleLyrics = useUiStore((s) => s.toggleLyrics);
  const toggleQueue = useUiStore((s) => s.toggleQueue);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);

  const RepeatGlyph = repeat === 'one' ? RepeatOneIcon : RepeatIcon;

  return (
    <footer
      className="z-40 flex h-[72px] shrink-0 items-center gap-3 border-t border-white/10 bg-black px-3 sm:h-[90px] sm:px-4"
      aria-label="Player"
    >
      {/* ── LEFT: artwork, title/artist, like ─────────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-[30%] sm:flex-none">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-surface sm:h-14 sm:w-14">
          {currentTrack?.image ? (
            <img
              src={currentTrack.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/25">
              <MusicNoteIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {currentTrack ? (
            <>
              <MarqueeText
                text={currentTrack.title}
                className="text-[13px] font-medium leading-tight text-white sm:text-sm"
              />
              {/* Artist links become live in Stage 5 when the artist route exists;
                  the album link is safe now because the id is already present. */}
              <div className="truncate text-[11px] leading-tight text-muted sm:text-xs">
                {currentTrack.album?.id ? (
                  <Link
                    to={`/album/${currentTrack.album.id}`}
                    className="hover:text-white hover:underline"
                  >
                    {currentTrack.artistNames || currentTrack.subtitle}
                  </Link>
                ) : (
                  <span>{currentTrack.artistNames || currentTrack.subtitle}</span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-muted sm:text-sm">Nothing playing</div>
          )}
        </div>

        {currentTrack && (
          <button
            type="button"
            onClick={() => toggleLike(currentTrack)}
            className={cn(
              'focus-ring hidden shrink-0 rounded p-1 transition-colors sm:block',
              isLiked ? 'text-accent hover:text-accent-hover' : 'text-muted hover:text-white',
            )}
            aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            aria-pressed={isLiked}
          >
            <HeartIcon filled={isLiked} className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── CENTRE: transport + seek ──────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 sm:w-[40%] sm:flex-1">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={toggleShuffle}
            disabled={!hasQueue}
            className={cn(
              'focus-ring hidden rounded p-1 transition-colors sm:block disabled:opacity-40',
              shuffle ? 'text-accent' : 'text-muted hover:text-white',
            )}
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <ShuffleIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={previousOrRestart}
            disabled={!hasQueue}
            className="focus-ring hidden rounded p-1 text-muted transition-colors hover:text-white disabled:opacity-40 sm:block"
            aria-label="Previous track"
          >
            <PreviousIcon className="h-4 w-4" />
          </button>

          {/* Large circular primary action. */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasQueue}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:h-9 sm:w-9"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {status === 'loading' ? (
              // Skeleton-consistent loading cue: a pulsing dot, not a spinner.
              <span className="h-2 w-2 animate-pulse rounded-full bg-black/70" />
            ) : isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="ml-[2px] h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => next()}
            disabled={!hasQueue || !hasNext}
            className="focus-ring rounded p-1 text-muted transition-colors hover:text-white disabled:opacity-40"
            aria-label="Next track"
          >
            <NextIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={cycleRepeat}
            className={cn(
              'focus-ring hidden rounded p-1 transition-colors sm:block',
              repeat !== 'off' ? 'text-accent' : 'text-muted hover:text-white',
            )}
            aria-label={`Repeat: ${repeat}`}
          >
            <RepeatGlyph className="h-4 w-4" />
          </button>
        </div>

        {/* Seek bar is desktop-only; the mobile bar stays minimal per L4. */}
        <SeekBar className="hidden sm:flex" />
      </div>

      {/* ── RIGHT: secondary controls ─────────────────────────────────── */}
      <div className="hidden items-center justify-end gap-3 sm:flex sm:w-[30%]">
        {error && (
          <span
            className="flex items-center gap-1 text-[11px] text-red-400"
            role="status"
            title={error}
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            <span className="max-w-[120px] truncate">{error}</span>
          </span>
        )}

        <Equalizer barCount={4} />

        <button
          type="button"
          onClick={toggleLyrics}
          className={cn(
            'focus-ring rounded p-1 transition-colors',
            isLyricsOpen ? 'text-accent' : 'text-muted hover:text-white',
          )}
          aria-label="Toggle lyrics"
          aria-pressed={isLyricsOpen}
        >
          <LyricsIcon className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={toggleQueue}
          className={cn(
            'focus-ring rounded p-1 transition-colors',
            isQueueOpen ? 'text-accent' : 'text-muted hover:text-white',
          )}
          aria-label="Toggle queue"
          aria-pressed={isQueueOpen}
        >
          <QueueIcon className="h-[18px] w-[18px]" />
        </button>

        <VolumeControl />

        <button
          type="button"
          onClick={toggleFullscreen}
          className="focus-ring rounded p-1 text-muted transition-colors hover:text-white"
          aria-label="Enter fullscreen player"
        >
          <FullscreenIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Mobile: expand to the fullscreen player (built in Stage 9). */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="focus-ring shrink-0 rounded p-1 text-muted sm:hidden"
        aria-label="Expand player"
      >
        <ChevronDownIcon className="h-5 w-5 rotate-180" />
      </button>
    </footer>
  );
}
