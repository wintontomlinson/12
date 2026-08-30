import { useMemo } from 'react';
import type { HomeFeed, Song } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Carousel } from '@/components/browse/Carousel';
import { EntityCard } from '@/components/browse/EntityCard';
import { CarouselSkeleton, RecentTileSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { PlayIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Home: greeting, recently played, and the four editorial carousels.
 *
 * All four sections arrive from ONE `/api/home` request (backed by
 * `webapi.getLaunchData`), so the page has a single loading and error state
 * rather than four independent ones.
 */
export function Home(): JSX.Element {
  const { data, error, isLoading, retry } = useApi<HomeFeed>('/home');
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);

  const greeting = useMemo(() => getGreeting(new Date()), []);

  return (
    <div className="pt-2">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
        {greeting}
      </h1>

      {/* Hidden entirely when empty, rather than showing an empty row (R1.3). */}
      {recentlyPlayed.length > 0 && <RecentlyPlayed songs={recentlyPlayed} />}

      {isLoading && !data && <HomeSkeleton />}

      {error && !data && (
        <ErrorState
          message={error}
          onRetry={retry}
          className="mt-4"
        />
      )}

      {data?.sections.map((section) => (
        <Carousel key={section.id} title={section.title}>
          {section.items.map((entity) => (
            // `type` is part of the key because ids are only unique per entity
            // type — an album and a song can share an id.
            <EntityCard key={`${entity.type}-${entity.id}`} entity={entity} />
          ))}
        </Carousel>
      ))}

      {data?.sections.length === 0 && (
        <ErrorState
          message="The catalogue returned no sections. This is usually temporary."
          onRetry={retry}
        />
      )}
    </div>
  );
}

/**
 * Compact grid of recently played tracks, sourced from localStorage.
 *
 * Clicking a tile plays that track with the rest of the history as its queue, so
 * playback continues instead of stopping after one song.
 */
function RecentlyPlayed({ songs }: { songs: Song[] }): JSX.Element {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const tiles = songs.slice(0, 8);

  return (
    <section className="mb-8">
      <h2 className="sr-only">Recently played</h2>
      {/*
        Capped at 3 columns. At 4 the tile text box is ~165px, which truncated a
        real title to "Gehra Hu…" — 3 columns keeps titles legible while still
        filling the row.
      */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((song, index) => {
          const isCurrent = song.id === currentId;
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => playQueue(tiles, index)}
              className="group focus-ring flex items-center gap-3 overflow-hidden rounded-md bg-white/[0.07] text-left transition-colors hover:bg-white/[0.16]"
            >
              <span className="h-16 w-16 shrink-0 overflow-hidden bg-surface-raised">
                {song.image && (
                  <img
                    src={song.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </span>

              <span className="min-w-0 flex-1 pr-2">
                <span
                  className={cn(
                    'block truncate text-sm font-semibold',
                    isCurrent ? 'text-accent' : 'text-white',
                  )}
                >
                  {song.title}
                </span>
                <span className="block truncate text-xs text-muted">{song.artistNames}</span>
              </span>

              <span
                className={cn(
                  'mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-black shadow-lg transition-all duration-300',
                  isCurrent && isPlaying
                    ? 'opacity-100'
                    : 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100',
                )}
              >
                <PlayIcon className="ml-[2px] h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Loading state shaped like the real page (requirement R8.1). */
function HomeSkeleton(): JSX.Element {
  return (
    <>
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <RecentTileSkeleton key={index} />
          ))}
        </div>
      </section>

      <CarouselSkeleton />
      <CarouselSkeleton />
      <CarouselSkeleton />
    </>
  );
}

/**
 * Time-of-day greeting (requirement R1.1).
 *
 * Derived from the client clock — the server has no idea what timezone the
 * listener is in, and a serverless function may run in any region.
 */
function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
