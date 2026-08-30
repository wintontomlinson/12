import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';

/**
 * Horizontally scrolling row with arrow controls.
 *
 * Uses native overflow scrolling rather than a transform-based track, so
 * trackpad/touch swiping and keyboard scrolling work without any extra code.
 * Arrows are progressive enhancement on top of that.
 *
 * The scrollbar is hidden visually (`scrollbar-none`) while the element stays
 * scrollable — a horizontal bar under every row would be noisy, but removing
 * scrollability would break touch users.
 */
export function Carousel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const { scrollLeft, scrollWidth, clientWidth } = track;
    setCanScrollLeft(scrollLeft > 4);
    // -4 absorbs sub-pixel rounding, which otherwise leaves the right arrow
    // enabled at the very end of the track.
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    measure();
    track.addEventListener('scroll', measure, { passive: true });

    // Re-measure when the viewport or the number of cards changes.
    const observer = new ResizeObserver(measure);
    observer.observe(track);

    return () => {
      track.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, children]);

  const scrollByPage = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    // Leave a sliver of the previous card visible so the scroll reads as
    // continuous rather than paginated.
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className="group/carousel mb-8">
      <header className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>

        <div className="flex items-center gap-2">
          {action}
          {/* Arrows are hidden on touch layouts, where swiping is natural. */}
          <div className="hidden items-center gap-1 sm:flex">
            <ArrowButton
              direction="left"
              disabled={!canScrollLeft}
              onClick={() => scrollByPage(-1)}
            />
            <ArrowButton
              direction="right"
              disabled={!canScrollRight}
              onClick={() => scrollByPage(1)}
            />
          </div>
        </div>
      </header>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  const Glyph = direction === 'left' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      className={cn(
        'focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-white transition-all',
        disabled
          ? 'cursor-default opacity-0'
          : 'opacity-70 hover:scale-105 hover:bg-surface-hover hover:opacity-100',
      )}
    >
      <Glyph className="h-4 w-4" />
    </button>
  );
}
