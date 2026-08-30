import { useParams } from 'react-router-dom';
import type { Album, Playlist, Song } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Banner, MetaDot } from '@/components/browse/Banner';
import { PlayCollectionButton } from '@/components/browse/PlayCollectionButton';
import { TrackRow } from '@/components/track/TrackRow';
import { BannerSkeleton, TrackListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/ErrorState';

/**
 * Album and playlist detail pages.
 *
 * One component for both: the upstream payloads differ only in a couple of
 * fields, and the page is otherwise identical (banner + tracklist). Splitting
 * them would duplicate the entire layout to vary a label.
 */
export function Collection({ kind }: { kind: 'album' | 'playlist' }): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const endpoint = kind === 'album' ? 'albums' : 'playlists';

  const { data, error, isLoading, retry } = useApi<Album | Playlist>(
    id ? `/${endpoint}/${id}` : null,
  );

  const playQueue = usePlayerStore((s) => s.playQueue);

  if (isLoading && !data) {
    return (
      <div className="pt-4">
        <BannerSkeleton />
        <TrackListSkeleton rows={10} />
      </div>
    );
  }

  if (error && !data) return <ErrorState message={error} onRetry={retry} className="mt-8" />;
  if (!data) return <></>;

  const songs = data.songs;
  const totalSeconds = songs.reduce((sum, song) => sum + song.duration, 0);

  // Albums credit artists; playlists credit a curator and follower count.
  const isAlbum = data.type === 'album';

  return (
    <div>
      <Banner
        kind={kind}
        title={data.title}
        image={data.image}
        /**
         * Albums: suppressed. Upstream's `header_desc` for an album is just its
         * metadata restated ("2013 · Hindi Album · Jeet Gannguli, Mithoon...")
         * which duplicates the meta line directly beneath it.
         * Playlists: kept, since there it is genuine editorial copy.
         */
        description={kind === 'playlist' ? data.description : null}
        meta={
          <>
            {isAlbum && (data as Album).artistNames && (
              <>
                <span className="font-semibold text-white">{(data as Album).artistNames}</span>
                <MetaDot />
              </>
            )}
            {isAlbum && (data as Album).year && (
              <>
                <span>{(data as Album).year}</span>
                <MetaDot />
              </>
            )}
            {!isAlbum && (data as Playlist).followerCount !== null && (
              <>
                <span>{(data as Playlist).followerCount?.toLocaleString()} followers</span>
                <MetaDot />
              </>
            )}
            <span>
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            </span>
            {totalSeconds > 0 && (
              <>
                <MetaDot />
                <span className="text-muted">{formatDuration(totalSeconds)}</span>
              </>
            )}
          </>
        }
        actions={<PlayCollectionButton songs={songs} />}
      />

      {songs.length === 0 ? (
        <EmptyState
          title="No tracks here"
          detail={`This ${kind} did not return any playable tracks.`}
        />
      ) : (
        <>
          {/* Column header, mirroring a desktop music client's tracklist. */}
          <div className="mb-2 hidden grid-cols-[24px_1fr_auto_auto] gap-3 border-b border-white/10 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid">
            <span className="text-center">#</span>
            <span>Title</span>
            {/* Album column is redundant on an album page. */}
            <span className="max-w-[220px]">{kind === 'playlist' ? 'Album' : ''}</span>
            <span className="pr-24 text-right">Time</span>
          </div>

          <div>
            {songs.map((song: Song, index: number) => (
              <TrackRow
                key={`${song.id}-${index}`}
                song={song}
                index={index}
                // On an album every track shares the same album — showing it
                // would be a column of identical text.
                showAlbum={kind === 'playlist'}
                onPlay={() => playQueue(songs, index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Human total runtime, e.g. "2 hr 51 min" or "38 min 12 sec". */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours} hr ${minutes} min`;
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} sec`;
}
