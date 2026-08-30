import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scrolls its text horizontally ONLY when it actually overflows.
 *
 * Measuring matters: unconditionally animating would make short titles drift for
 * no reason. Overflow is re-measured on text change and on container resize,
 * because a sidebar toggle or window resize can flip a title between fitting and
 * not.
 *
 * The animation distance is computed from the real overflow amount and exposed
 * as a CSS variable, so the keyframes can be static while the travel adapts to
 * the text.
 */
export function MarqueeText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = (): void => {
      // +1 absorbs sub-pixel rounding, which would otherwise animate text that
      // visually fits exactly.
      const overflow = textEl.scrollWidth - container.clientWidth;
      setOverflowPx(overflow > 1 ? overflow : 0);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(textEl);
    return () => observer.disconnect();
  }, [text]);

  const isScrolling = overflowPx > 0;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      <span
        ref={textRef}
        className={cn('inline-block whitespace-nowrap', isScrolling && 'animate-marquee')}
        style={
          isScrolling
            ? // Consumed by the `marquee` keyframes in tailwind.config.ts.
              ({ ['--marquee-distance' as string]: `${overflowPx}px` } as React.CSSProperties)
            : undefined
        }
        // Full text stays available to assistive tech and on hover even when
        // visually clipped.
        title={text}
      >
        {text}
      </span>
    </div>
  );
}
