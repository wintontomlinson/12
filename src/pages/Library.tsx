import { Link } from 'react-router-dom';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { TrackRow } from '@/components/track/TrackRow';
import { EmptyState } from '@/components/ui/ErrorState';
import { HeartIcon } from '@/components/ui/icons';

/**
 * Your Library — everything held locally.
 *
 * Sur has no accounts, so "library" means what this browser has saved: liked
 * songs and listening history. Both come from `localStorage`, so this page never
 * hits the network.
 */
export function Library(): JSX.Element {
  const likedSongs = useLibraryStore((s) => s.likedSongs);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const clearRecentlyPlayed = useLibraryStore((s) => s.clearRecentlyPlayed);

  const playQueue = usePlayerStore((s) => s.playQueue);

  const isEmpty = likedSongs.length === 0 && recentlyPlayed.length === 0;

  return (
    <div className="pt-4">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
        Your Library
      </h1>

      {isEmpty && (
        <EmptyState
          title="Nothing saved yet"
          detail="Play a track or like a song and it will show up here."
        />
      )}

      {/* Liked Songs presented as a single entry point rather than a duplicate list. */}
      {likedSongs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold text-white">Playlists</h2>
          <Link
            to="/liked"
            className="focus-ring group flex max-w-md items-center gap-4 rounded-card bg-surface p-3 transition-colors hover:bg-surface-hover"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-gradient-to-br from-accent to-accent-muted text-black">
              <HeartIcon filled className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Liked Songs</span>
              <span className="block text-xs text-muted">
                {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'}
              </span>
            </span>
          </Link>
        </section>
      )}

      {recentlyPlayed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recently played</h2>
            <button
              type="button"
              onClick={clearRecentlyPlayed}
              className="focus-ring rounded px-2 py-1 text-xs font-semibold text-muted hover:text-white"
            >
              Clear history
            </button>
          </div>

          <div>
            {recentlyPlayed.map((song, index) => (
              <TrackRow
                key={song.id}
                song={song}
                index={index}
                showAlbum
                onPlay={() => playQueue(recentlyPlayed, index)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
