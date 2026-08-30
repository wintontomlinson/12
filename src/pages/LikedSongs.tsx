import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Banner, MetaDot } from '@/components/browse/Banner';
import { PlayCollectionButton } from '@/components/browse/PlayCollectionButton';
import { TrackRow } from '@/components/track/TrackRow';
import { EmptyState } from '@/components/ui/ErrorState';
import { HeartIcon } from '@/components/ui/icons';

/**
 * Liked Songs — the automatic collection (requirement R5.2).
 *
 * Reads entirely from `localStorage` via `useLibraryStore`: no network request,
 * so it renders instantly and keeps working while the upstream API is down.
 * Whole `Song` objects are persisted for exactly this reason.
 */
export function LikedSongs(): JSX.Element {
  const likedSongs = useLibraryStore((s) => s.likedSongs);
  const playQueue = usePlayerStore((s) => s.playQueue);

  const totalSeconds = likedSongs.reduce((sum, song) => sum + song.duration, 0);
  const minutes = Math.round(totalSeconds / 60);

  return (
    <div>
      <Banner
        kind="Playlist"
        title="Liked Songs"
        // No artwork to fetch — the heart tile below stands in for a cover.
        image={null}
        meta={
          <>
            <span className="font-semibold text-white">Your library</span>
            <MetaDot />
            <span>
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'}
            </span>
            {minutes > 0 && (
              <>
                <MetaDot />
                <span className="text-muted">about {minutes} min</span>
              </>
            )}
          </>
        }
        actions={<PlayCollectionButton songs={likedSongs} />}
      />

      {likedSongs.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            title="Songs you like will appear here"
            detail="Tap the heart on any track — in the player bar or a tracklist — to save it."
          />
          <div className="mt-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-muted">
              <HeartIcon className="h-7 w-7" />
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 hidden grid-cols-[24px_1fr_auto_auto] gap-3 border-b border-white/10 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid">
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="max-w-[220px]">Album</span>
            <span className="pr-24 text-right">Time</span>
          </div>

          <div>
            {likedSongs.map((song, index) => (
              <TrackRow
                key={song.id}
                song={song}
                index={index}
                showAlbum
                onPlay={() => playQueue(likedSongs, index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
