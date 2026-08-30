import { selectCurrentTrack, usePlayerStore } from '@/store/usePlayerStore';
import { useUiStore } from '@/store/useUiStore';
import { TrackRow } from '@/components/track/TrackRow';
import { EmptyState } from '@/components/ui/ErrorState';
import { CloseIcon } from '@/components/ui/icons';

/**
 * Queue side panel (requirement R4.2).
 *
 * Shows the current track and everything after it. Tracks already played are
 * hidden — a queue view is about what is coming, and listing history here would
 * duplicate "Recently played".
 */
export function QueuePanel(): JSX.Element {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const jumpTo = usePlayerStore((s) => s.jumpTo);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const closeQueue = useUiStore((s) => s.toggleQueue);

  const upcoming = queue.slice(queueIndex + 1);

  return (
    <aside
      className="flex h-full w-full flex-col rounded-card bg-surface md:w-[340px]"
      aria-label="Play queue"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-base font-bold text-white">Queue</h2>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              className="focus-ring rounded px-2 py-1 text-xs font-semibold text-muted hover:text-white"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={closeQueue}
            aria-label="Close queue"
            className="focus-ring rounded p-1 text-muted hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {queue.length === 0 ? (
          <EmptyState title="Your queue is empty" detail="Play something to get started." />
        ) : (
          <>
            {currentTrack && (
              <section className="mb-4">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Now playing
                </p>
                <TrackRow
                  song={currentTrack}
                  index={queueIndex}
                  onPlay={() => jumpTo(queueIndex)}
                />
              </section>
            )}

            <section>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Next up
              </p>

              {upcoming.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted">
                  Nothing queued after this track.
                </p>
              ) : (
                upcoming.map((song, offset) => {
                  // Offset back to the real queue index; the panel renders a slice.
                  const realIndex = queueIndex + 1 + offset;
                  return (
                    <TrackRow
                      key={`${song.id}-${realIndex}`}
                      song={song}
                      index={realIndex}
                      onPlay={() => jumpTo(realIndex)}
                      onRemove={() => removeFromQueue(realIndex)}
                    />
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
