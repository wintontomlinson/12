import { useParams, useSearchParams } from 'react-router-dom';
import type { Album, Artist, Playlist } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { usePlayerStore } from '@/store/usePlayerStore';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { PlayIcon } from '@/components/ui/icons';
import { formatTime } from '@/lib/utils';

/**
 * Interim pages for routes whose full designs land in later stages.
 *
 * These are deliberately plain, but they are NOT dead ends: each fetches its
 * real data and can start playback, so navigation from Home always leads
 * somewhere that works. Stage 5 replaces the collection pages with the banner +
 * tracklist design; Stage 4 replaces search; Stage 8 replaces Liked Songs.
 */

function StageNote({ stage, what }: { stage: string; what: string }): JSX.Element {
  return (
    <p className="mb-6 rounded-card border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-muted">
      <span className="font-semibold text-white">{what}</span> gets its full design in {stage}.
      Real data and playback already work here.
    </p>
  );
}

/** Album / playlist interim page — both are a header plus a tracklist. */
export function CollectionPage({ kind }: { kind: 'album' | 'playlist' }): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const path = id ? `/${kind === 'album' ? 'albums' : 'playlists'}/${id}` : null;
  const { data, error, isLoading, retry } = useApi<Album | Playlist>(path);

  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  if (isLoading && !data) {
    return (
      <div className="pt-4">
        <div className="mb-6 flex items-end gap-5">
          <Skeleton className="h-40 w-40 rounded-card" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-10 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={retry} className="mt-6" />;
  if (!data) return <></>;

  const songs = data.songs;

  return (
    <div className="pt-4">
      <StageNote stage="Stage 5" what={kind === 'album' ? 'Album pages' : 'Playlist pages'} />

      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end">
        {data.image && (
          <img
            src={data.image}
            alt=""
            className="h-40 w-40 shrink-0 rounded-card object-cover shadow-2xl"
          />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{kind}</p>
          <h1 className="mt-1 break-words text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {data.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {'artistNames' in data && data.artistNames ? `${data.artistNames} • ` : ''}
            {data.songCount} {data.songCount === 1 ? 'song' : 'songs'}
          </p>
        </div>
      </header>

      {songs.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => playQueue(songs, 0)}
            className="focus-ring mb-5 flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105"
          >
            <PlayIcon className="h-4 w-4" /> Play
          </button>

          <ol className="divide-y divide-white/5">
            {songs.map((song, index) => (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => playQueue(songs, index)}
                  className="focus-ring group flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-white/5"
                >
                  <span className="w-6 text-right text-xs text-muted">{index + 1}</span>
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-raised">
                    {song.image && (
                      <img src={song.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        song.id === currentId
                          ? 'block truncate text-sm text-accent'
                          : 'block truncate text-sm text-white'
                      }
                    >
                      {song.title}
                    </span>
                    <span className="block truncate text-xs text-muted">{song.artistNames}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {formatTime(song.duration)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-sm text-muted">This {kind} has no tracks.</p>
      )}
    </div>
  );
}

/** Artist interim page — identity plus top songs. */
export function ArtistPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, retry } = useApi<Artist>(id ? `/artists/${id}` : null);

  const playQueue = usePlayerStore((s) => s.playQueue);

  if (isLoading && !data) {
    return (
      <div className="flex gap-4 overflow-hidden pt-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={retry} className="mt-6" />;
  if (!data) return <></>;

  return (
    <div className="pt-4">
      <StageNote stage="Stage 5" what="Artist pages" />

      <header className="mb-6 flex items-center gap-5">
        {data.image && (
          <img src={data.image} alt="" className="h-32 w-32 rounded-full object-cover shadow-2xl" />
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {data.name}
          </h1>
          {data.followerCount !== null && (
            <p className="mt-2 text-sm text-muted">
              {data.followerCount.toLocaleString()} followers
            </p>
          )}
        </div>
      </header>

      {data.topSongs.length > 0 && (
        <button
          type="button"
          onClick={() => playQueue(data.topSongs, 0)}
          className="focus-ring mb-6 flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105"
        >
          <PlayIcon className="h-4 w-4" /> Play top songs
        </button>
      )}

      <h2 className="mb-3 text-xl font-bold text-white">Popular</h2>
      <ol className="divide-y divide-white/5">
        {data.topSongs.map((song, index) => (
          <li key={song.id}>
            <button
              type="button"
              onClick={() => playQueue(data.topSongs, index)}
              className="focus-ring flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-white/5"
            >
              <span className="w-6 text-right text-xs text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">{song.title}</span>
              <span className="text-xs tabular-nums text-muted">{formatTime(song.duration)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Search results page — full grouped design lands in Stage 4. */
export function SearchPage(): JSX.Element {
  // `useSearchParams`, not `window.location`: the latter is read once at render
  // and would go stale when the query changes without a remount.
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  return (
    <div className="pt-6">
      <StageNote stage="Stage 4" what="The search results page" />
      <h1 className="text-2xl font-extrabold text-white">
        {query ? `Results for “${query}”` : 'Search'}
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Live suggestions in the top bar are already wired to the real API — start typing there to
        play a track or open an album. This page becomes the full grouped results view next.
      </p>
    </div>
  );
}

/** Liked Songs — full design lands in Stage 8. */
export function LikedSongsPage(): JSX.Element {
  return (
    <div className="pt-6">
      <StageNote stage="Stage 8" what="Liked Songs" />
      <h1 className="text-2xl font-extrabold text-white">Liked Songs</h1>
      <p className="mt-3 text-sm text-muted">
        Like a track from the player bar and it will collect here.
      </p>
    </div>
  );
}

/** Your Library — full design lands in Stage 8. */
export function LibraryPage(): JSX.Element {
  return (
    <div className="pt-6">
      <StageNote stage="Stage 8" what="Your Library" />
      <h1 className="text-2xl font-extrabold text-white">Your Library</h1>
    </div>
  );
}

/** Unmatched route. */
export function NotFoundPage(): JSX.Element {
  return (
    <div className="pt-16 text-center">
      <h1 className="text-4xl font-extrabold text-white">Page not found</h1>
      <p className="mt-3 text-sm text-muted">
        The link may be broken, or the page may have moved.
      </p>
    </div>
  );
}
