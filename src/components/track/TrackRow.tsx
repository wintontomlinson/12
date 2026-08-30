import { Link, useNavigate } from 'react-router-dom';
import type { Song } from '@shared/types';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn, formatTime } from '@/lib/utils';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import {
  AlbumIcon,
  HeartIcon,
  MusicNoteIcon,
  PlayIcon,
  PlayNextIcon,
  PlayingBarsIcon,
  QueueAddIcon,
  TrashIcon,
} from '@/components/ui/icons';

/**
 * One row in a tracklist.
 *
 * Shared by album, playlist, artist, search, Liked Songs and the queue panel, so
 * hover, like, and the context menu behave identically everywhere. Variants only
 * change what the leading column shows.
 */
export function TrackRow({
  song,
  index,
  onPlay,
  showArtwork = true,
  showAlbum = false,
  /** Queue rows offer removal instead of enqueueing. */
  onRemove,
}: {
  song: Song;
  index: number;
  onPlay: () => void;
  showArtwork?: boolean;
  showAlbum?: boolean;
  onRemove?: () => void;
}): JSX.Element {
  const navigate = useNavigate();

  const currentId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);

  const isLiked = useLibraryStore((s) => s.likedSongs.some((liked) => liked.id === song.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const isCurrent = song.id === currentId;

  const menuItems: MenuItem[] = [
    { label: 'Play next', icon: <PlayNextIcon className="h-4 w-4" />, onSelect: () => playNext(song) },
    { label: 'Add to queue', icon: <QueueAddIcon className="h-4 w-4" />, onSelect: () => addToQueue(song) },
    {
      label: isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs',
      icon: <HeartIcon filled={isLiked} className="h-4 w-4" />,
      onSelect: () => toggleLike(song),
    },
  ];

  if (song.album?.id) {
    menuItems.push({
      label: 'Go to album',
      icon: <AlbumIcon className="h-4 w-4" />,
      onSelect: () => navigate(`/album/${song.album?.id ?? ''}`),
    });
  }

  if (onRemove) {
    menuItems.push({
      label: 'Remove from queue',
      icon: <TrashIcon className="h-4 w-4" />,
      onSelect: onRemove,
      destructive: true,
    });
  }

  return (
    <div
      onDoubleClick={onPlay}
      className="group grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/10 sm:grid-cols-[24px_1fr_auto_auto]"
    >
      {/* Leading column: index, swapped for a play button on hover. */}
      <div className="flex h-8 w-6 items-center justify-center">
        {isCurrent && isPlaying ? (
          <PlayingBarsIcon className="group-hover:hidden" />
        ) : (
          <span
            className={cn(
              'text-sm tabular-nums group-hover:hidden',
              isCurrent ? 'text-accent' : 'text-muted',
            )}
          >
            {index + 1}
          </span>
        )}
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${song.title}`}
          className="focus-ring hidden rounded text-white group-hover:block"
        >
          <PlayIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title block */}
      <div className="flex min-w-0 items-center gap-3">
        {showArtwork && (
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-raised">
            {song.image ? (
              <img src={song.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-white/25">
                <MusicNoteIcon className="h-4 w-4" />
              </span>
            )}
          </span>
        )}

        <span className="min-w-0">
          <button
            type="button"
            onClick={onPlay}
            className={cn(
              'focus-ring block max-w-full truncate rounded text-left text-sm font-medium',
              isCurrent ? 'text-accent' : 'text-white',
            )}
          >
            {song.title}
          </button>
          <span className="block truncate text-xs text-muted">{song.artistNames}</span>
        </span>
      </div>

      {/* Album column — desktop only, and only where it adds information. */}
      {showAlbum && (
        <div className="hidden min-w-0 max-w-[220px] sm:block">
          {song.album?.id ? (
            <Link
              to={`/album/${song.album.id}`}
              className="block truncate text-xs text-muted hover:text-white hover:underline"
            >
              {song.album.name}
            </Link>
          ) : (
            <span className="block truncate text-xs text-muted">—</span>
          )}
        </div>
      )}

      {/* Trailing controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => toggleLike(song)}
          aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          aria-pressed={isLiked}
          className={cn(
            'focus-ring rounded p-1 transition-all',
            isLiked
              ? 'text-accent opacity-100'
              : 'text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <HeartIcon filled={isLiked} className="h-4 w-4" />
        </button>

        <span className="w-10 text-right text-xs tabular-nums text-muted">
          {formatTime(song.duration)}
        </span>

        <Menu
          items={menuItems}
          label={`More options for ${song.title}`}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        />
      </div>
    </div>
  );
}
