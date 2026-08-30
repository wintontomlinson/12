import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BrowseEntity } from '@shared/types';
import { playEntity } from '@/lib/play';
import {
  entityIsRound,
  entityPlayLabel,
  entityRoute,
  entitySubtitle,
  entityTitle,
} from '@/lib/entity';
import { cn } from '@/lib/utils';
import { MusicNoteIcon, PlayIcon, UserIcon } from '@/components/ui/icons';
import { usePlayerStore } from '@/store/usePlayerStore';

/**
 * A browse card, rendered from the entity's own `type`.
 *
 * Interaction follows the entity kind rather than the carousel it came from:
 *   • song → the whole card plays it (there is no song detail page).
 *   • album / playlist / artist → the card navigates; the hover button plays.
 *
 * The card is a `<div>` with an inner `<button>` rather than nested buttons or
 * an `<a>` wrapping a `<button>`, both of which are invalid HTML and break
 * keyboard semantics.
 */
export function EntityCard({ entity }: { entity: BrowseEntity }): JSX.Element {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);

  const route = entityRoute(entity);
  const round = entityIsRound(entity);
  const title = entityTitle(entity);
  const subtitle = entitySubtitle(entity);

  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisSongPlaying = entity.type === 'song' && entity.id === currentTrackId && isPlaying;

  const activate = (): void => {
    if (route) navigate(route);
    else void startPlayback();
  };

  const startPlayback = async (): Promise<void> => {
    // Albums/playlists need a fetch before playback, so show the button as busy
    // rather than leaving the click feeling unacknowledged.
    setIsStarting(true);
    try {
      await playEntity(entity);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      role={route ? 'link' : 'button'}
      tabIndex={0}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }}
      className="focus-ring group relative w-[150px] shrink-0 cursor-pointer rounded-card bg-surface p-3 transition-all duration-300 hover:bg-surface-hover hover:shadow-xl hover:shadow-black/50 sm:w-[170px]"
    >
      <div className="relative mb-3">
        <div
          className={cn(
            'aspect-square w-full overflow-hidden bg-surface-raised transition-transform duration-300 group-hover:scale-[1.03]',
            round ? 'rounded-full' : 'rounded-md',
          )}
        >
          {entity.image ? (
            <img
              src={entity.image}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              {round ? <UserIcon className="h-10 w-10" /> : <MusicNoteIcon className="h-10 w-10" />}
            </div>
          )}
        </div>

        {/* Play affordance: revealed on hover/focus, per the design spec. */}
        <button
          type="button"
          onClick={(event) => {
            // Without this the card's own handler would also fire and navigate
            // away from the track that just started.
            event.stopPropagation();
            void startPlayback();
          }}
          disabled={isStarting}
          aria-label={entityPlayLabel(entity)}
          className={cn(
            'focus-ring absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-black shadow-lg transition-all duration-300 hover:scale-105 hover:bg-accent-hover',
            // Keep it visible while this song is playing so the active card
            // reads as active even without hover.
            isThisSongPlaying
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
          )}
        >
          {isStarting ? (
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-black/70" />
          ) : (
            <PlayIcon className="ml-[2px] h-4 w-4" />
          )}
        </button>
      </div>

      <p
        className={cn(
          'truncate text-sm font-semibold',
          isThisSongPlaying ? 'text-accent' : 'text-white',
        )}
        title={title}
      >
        {title}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted" title={subtitle}>
        {subtitle}
      </p>
    </div>
  );
}
