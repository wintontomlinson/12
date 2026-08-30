import { cn } from '@/lib/utils';

/**
 * Shimmer placeholder.
 *
 * A sweeping highlight over a surface-coloured block, not a spinner
 * (requirement R8.1). The overlay starts translated fully left and animates to
 * fully right, so the sweep enters and exits cleanly.
 */
export function Skeleton({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn('relative overflow-hidden bg-surface-raised', className)} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

/**
 * Placeholder shaped like an `EntityCard`.
 *
 * Matching the real card's dimensions matters: it reserves the correct space so
 * content does not jump when data arrives.
 */
export function CardSkeleton({ round = false }: { round?: boolean }): JSX.Element {
  return (
    <div className="w-[150px] shrink-0 rounded-card bg-surface p-3 sm:w-[170px]">
      <Skeleton className={cn('mb-3 aspect-square w-full', round ? 'rounded-full' : 'rounded-md')} />
      <Skeleton className="mb-2 h-3.5 w-4/5 rounded" />
      <Skeleton className="h-3 w-3/5 rounded" />
    </div>
  );
}

/** A carousel's worth of card placeholders, including the heading. */
export function CarouselSkeleton({
  cards = 6,
  round = false,
}: {
  cards?: number;
  round?: boolean;
}): JSX.Element {
  return (
    <section className="mb-8">
      <Skeleton className="mb-4 h-6 w-44 rounded" />
      {/* overflow-hidden, not scrollable: a placeholder should not be interactive. */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: cards }).map((_, index) => (
          <CardSkeleton key={index} round={round} />
        ))}
      </div>
    </section>
  );
}

/** Placeholder for the compact "Recently played" tiles. */
export function RecentTileSkeleton(): JSX.Element {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-md bg-surface-raised">
      <Skeleton className="h-16 w-16 shrink-0 rounded-l-md" />
      <Skeleton className="mr-4 h-4 flex-1 rounded" />
    </div>
  );
}
