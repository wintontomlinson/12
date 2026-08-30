import { useSearchParams } from 'react-router-dom';
import type { BrowseEntity, SearchResults, SearchType, Song } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Carousel } from '@/components/browse/Carousel';
import { EntityCard } from '@/components/browse/EntityCard';
import { TrackRow } from '@/components/track/TrackRow';
import { CardSkeleton, TrackListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/ErrorState';
import { SearchIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Search results (requirement R2).
 *
 * The query lives in the URL (`?q=`), so results are shareable and survive a
 * refresh; this page is a pure function of the URL rather than of local state.
 * The `type` filter is also URL-backed so a filtered view can be linked.
 */

const FILTERS: ReadonlyArray<{ value: SearchType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'song', label: 'Songs' },
  { value: 'album', label: 'Albums' },
  { value: 'artist', label: 'Artists' },
  { value: 'playlist', label: 'Playlists' },
];

export function Search(): JSX.Element {
  const [params, setParams] = useSearchParams();

  const query = (params.get('q') ?? '').trim();
  const rawType = params.get('type') ?? 'all';
  const type: SearchType = FILTERS.some((f) => f.value === rawType)
    ? (rawType as SearchType)
    : 'all';

  const playQueue = usePlayerStore((s) => s.playQueue);

  const { data, error, isLoading, retry } = useApi<SearchResults>(
    query.length > 0
      ? `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${type === 'all' ? 20 : 40}`
      : null,
  );

  const setType = (next: SearchType): void => {
    const updated = new URLSearchParams(params);
    if (next === 'all') updated.delete('type');
    else updated.set('type', next);
    // `replace` keeps filter toggling out of the history stack, so Back returns
    // to wherever the user came from rather than stepping through filters.
    setParams(updated, { replace: true });
  };

  if (query.length === 0) {
    return (
      <div className="pt-16 text-center">
        <SearchIcon className="mx-auto h-10 w-10 text-muted" />
        <h1 className="mt-4 text-2xl font-extrabold text-white">Search for music</h1>
        <p className="mt-2 text-sm text-muted">
          Find songs, albums, artists and playlists using the box above.
        </p>
      </div>
    );
  }

  const totalResults = data
    ? data.songs.length + data.albums.length + data.artists.length + data.playlists.length
    : 0;

  return (
    <div className="pt-4">
      <h1 className="text-xl font-bold text-white sm:text-2xl">
        Results for <span className="text-accent">“{query}”</span>
      </h1>

      {/* Grouped so assistive tech announces these as one set of filters rather
          than five unrelated toggle buttons. */}
      <div
        role="group"
        aria-label="Filter results by type"
        className="mt-4 mb-6 flex flex-wrap gap-2"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setType(filter.value)}
            aria-pressed={type === filter.value}
            className={cn(
              'focus-ring rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors',
              type === filter.value
                ? 'bg-white text-black'
                : 'bg-surface-raised text-white hover:bg-surface-hover',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && !data && <SearchSkeleton />}

      {error && !data && <ErrorState message={error} onRetry={retry} />}

      {data && totalResults === 0 && (
        <EmptyState
          title={`No results for “${query}”`}
          detail="Check the spelling, or try a different search term."
        />
      )}

      {data && totalResults > 0 && (
        <div className="space-y-8">
          {data.songs.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold text-white">Songs</h2>
              <div>
                {data.songs.map((song: Song, index: number) => (
                  <TrackRow
                    key={song.id}
                    song={song}
                    index={index}
                    showAlbum
                    // Playing a result queues the whole result set, so playback
                    // continues instead of stopping after one track.
                    onPlay={() => playQueue(data.songs, index)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.artists.length > 0 && (
            <Carousel title="Artists">
              {data.artists.map((artist) => (
                <EntityCard key={artist.id} entity={artist as BrowseEntity} />
              ))}
            </Carousel>
          )}

          {data.albums.length > 0 && (
            <Carousel title="Albums">
              {data.albums.map((album) => (
                <EntityCard key={album.id} entity={album as BrowseEntity} />
              ))}
            </Carousel>
          )}

          {data.playlists.length > 0 && (
            <Carousel title="Playlists">
              {data.playlists.map((playlist) => (
                <EntityCard key={playlist.id} entity={playlist as BrowseEntity} />
              ))}
            </Carousel>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSkeleton(): JSX.Element {
  return (
    <div className="space-y-8">
      <TrackListSkeleton rows={5} />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
