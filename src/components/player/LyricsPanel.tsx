import { useLyrics } from '@/hooks/useLyrics';
import { selectCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { useUiStore } from '@/store/useUiStore';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CloseIcon } from '@/components/ui/icons';

/**
 * Static lyrics side panel (requirement R7).
 *
 * Deliberately NOT karaoke-style. `lyrics.getLyrics` returns plain text with no
 * timing data whatsoever — verified — so there is nothing to synchronise against
 * playback position. Presenting a scrolling highlight would be inventing timings
 * that do not exist.
 *
 * Lyrics are requested for whatever is playing, without consulting
 * `song.hasLyrics`, because that flag is wrong for tracks that genuinely have
 * lyrics (see `useLyrics`).
 */
export function LyricsPanel(): JSX.Element {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const closeLyrics = useUiStore((s) => s.toggleLyrics);

  const { lyrics, copyright, isLoading, error, retry } = useLyrics(currentTrack?.id ?? null);

  return (
    <aside
      className="flex h-full w-full flex-col rounded-card bg-surface md:w-[340px]"
      aria-label="Lyrics"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-base font-bold text-white">Lyrics</h2>
        <button
          type="button"
          onClick={closeLyrics}
          aria-label="Close lyrics"
          className="focus-ring rounded p-1 text-muted hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!currentTrack && (
          <p className="text-sm text-muted">Play a track to see its lyrics.</p>
        )}

        {currentTrack && (
          <>
            <p className="mb-1 text-sm font-semibold text-white">{currentTrack.title}</p>
            <p className="mb-4 text-xs text-muted">{currentTrack.artistNames}</p>

            {isLoading && (
              <div className="space-y-2.5">
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-3.5 rounded"
                    // Ragged widths read as lines of verse rather than a table.
                    style={{ width: `${60 + ((index * 13) % 35)}%` }}
                  />
                ))}
              </div>
            )}

            {error && !isLoading && (
              <ErrorState message={error} onRetry={retry} compact />
            )}

            {!isLoading && !error && lyrics === null && (
              // A neutral message, NOT an error: roughly half of all tracks have
              // no lyrics and that is expected (requirement R7.3).
              <div className="py-6">
                <p className="text-sm font-semibold text-white">No lyrics available</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  This track has no lyrics in the catalogue.
                </p>
              </div>
            )}

            {!isLoading && lyrics !== null && (
              <>
                {/*
                  `whitespace-pre-line` renders the newlines the backend already
                  converted from upstream `<br>` tags, so no HTML is injected here.
                */}
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-white/90">
                  {lyrics}
                </p>
                {copyright && (
                  <p className="mt-6 border-t border-white/5 pt-3 text-[11px] text-muted">
                    {copyright}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
