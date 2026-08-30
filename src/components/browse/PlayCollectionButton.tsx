import type { Song } from '@shared/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';
import { PauseIcon, PlayIcon, ShuffleIcon } from '@/components/ui/icons';

/**
 * Large play/pause control for a collection, plus a shuffle entry point.
 *
 * If the collection is already the active queue, this toggles playback instead
 * of restarting from the top — restarting a track the user is listening to is
 * the more annoying failure.
 */
export function PlayCollectionButton({ songs }: { songs: Song[] }): JSX.Element | null {
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  if (songs.length === 0) return null;

  // Identity by first/last id and length is enough to recognise "this is the
  // collection already loaded" without deep-comparing every track.
  const isActiveQueue =
    queue.length === songs.length &&
    queue.length > 0 &&
    queue[0]?.id === songs[0]?.id &&
    queue[queue.length - 1]?.id === songs[songs.length - 1]?.id;

  const handlePlay = (): void => {
    if (isActiveQueue) togglePlay();
    else playQueue(songs, 0);
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        aria-label={isActiveQueue && isPlaying ? 'Pause' : 'Play'}
        className="focus-ring flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black shadow-xl transition-transform hover:scale-105 hover:bg-accent-hover active:scale-95"
      >
        {isActiveQueue && isPlaying ? (
          <PauseIcon className="h-6 w-6" />
        ) : (
          <PlayIcon className="ml-[3px] h-6 w-6" />
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          // Shuffling from a cold start should also begin playback, otherwise the
          // button appears to do nothing.
          if (!isActiveQueue) playQueue(songs, 0);
          toggleShuffle();
        }}
        aria-label="Shuffle"
        aria-pressed={shuffle}
        className={cn(
          'focus-ring rounded-full p-2 transition-colors',
          shuffle ? 'text-accent' : 'text-muted hover:text-white',
        )}
      >
        <ShuffleIcon className="h-6 w-6" />
      </button>
    </>
  );
}
