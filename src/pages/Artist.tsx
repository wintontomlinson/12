import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Artist as ArtistType, BrowseEntity } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Banner, MetaDot } from '@/components/browse/Banner';
import { PlayCollectionButton } from '@/components/browse/PlayCollectionButton';
import { Carousel } from '@/components/browse/Carousel';
import { EntityCard } from '@/components/browse/EntityCard';
import { TrackRow } from '@/components/track/TrackRow';
import { BannerSkeleton, CardSkeleton, TrackListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/ErrorState';

/** Popular tracks shown before the user expands the list. */
const COLLAPSED_TRACK_COUNT = 5;

/**
 * Artist page: hero, popular tracks, albums, singles, biography.
 */
export function Artist(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, retry } = useApi<ArtistType>(id ? `/artists/${id}` : null);

  const playQueue = usePlayerStore((s) => s.playQueue);
  const [showAllTracks, setShowAllTracks] = useState(false);

  if (isLoading && !data) {
    return (
      <div className="pt-4">
        <BannerSkeleton round />
        <TrackListSkeleton rows={5} />
        <div className="mt-8 flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) return <ErrorState message={error} onRetry={retry} className="mt-8" />;
  if (!data) return <></>;

  const visibleTracks = showAllTracks
    ? data.topSongs
    : data.topSongs.slice(0, COLLAPSED_TRACK_COUNT);

  const hasAnyContent =
    data.topSongs.length > 0 || data.topAlbums.length > 0 || data.singles.length > 0;

  return (
    <div>
      <Banner
        kind={data.isVerified ? 'Verified artist' : 'Artist'}
        title={data.name}
        image={data.image}
        round
        meta={
          <>
            {data.followerCount !== null && (
              <span>{data.followerCount.toLocaleString()} followers</span>
            )}
            {data.dominantLanguage && (
              <>
                <MetaDot />
                <span className="capitalize">{data.dominantLanguage}</span>
              </>
            )}
          </>
        }
        actions={<PlayCollectionButton songs={data.topSongs} />}
      />

      {!hasAnyContent && (
        <EmptyState title="Nothing to show" detail="This artist has no available tracks." />
      )}

      {data.topSongs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold text-white sm:text-2xl">Popular</h2>
          <div>
            {visibleTracks.map((song, index) => (
              <TrackRow
                key={song.id}
                song={song}
                index={index}
                showAlbum
                // Queue the FULL list, not just the visible slice, so collapsing
                // the view does not truncate playback.
                onPlay={() => playQueue(data.topSongs, index)}
              />
            ))}
          </div>

          {data.topSongs.length > COLLAPSED_TRACK_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllTracks((open) => !open)}
              className="focus-ring mt-2 rounded px-2 py-1 text-sm font-semibold text-muted hover:text-white"
            >
              {showAllTracks ? 'Show less' : 'See more'}
            </button>
          )}
        </section>
      )}

      {data.topAlbums.length > 0 && (
        <Carousel title="Albums">
          {data.topAlbums.map((album) => (
            <EntityCard key={album.id} entity={album as BrowseEntity} />
          ))}
        </Carousel>
      )}

      {data.singles.length > 0 && (
        <Carousel title="Singles and EPs">
          {data.singles.map((single) => (
            <EntityCard key={single.id} entity={single as BrowseEntity} />
          ))}
        </Carousel>
      )}

      {data.similarArtists.length > 0 && (
        <Carousel title="Fans also like">
          {data.similarArtists.map((similar) => (
            <EntityCard
              key={similar.id}
              entity={
                {
                  type: 'artist',
                  id: similar.id,
                  name: similar.name,
                  image: similar.image,
                  url: null,
                  followerCount: null,
                  isVerified: false,
                } satisfies BrowseEntity
              }
            />
          ))}
        </Carousel>
      )}

      {data.bio && (
        <section className="mb-8 max-w-prose">
          <h2 className="mb-3 text-xl font-bold text-white sm:text-2xl">About</h2>
          {/* Upstream bios contain paragraph breaks; preserve them without
              rendering raw HTML. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{data.bio}</p>
        </section>
      )}
    </div>
  );
}
