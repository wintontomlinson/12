import { useEffect, useState } from 'react';
import { usePlayerControls } from '@/hooks/usePlayer';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn, formatTime } from '@/lib/utils';

/**
 * Draggable progress bar with a green fill.
 *
 * Built on a native `<input type="range">` rather than a div with pointer
 * handlers. That choice buys keyboard support (arrows/Home/End), screen-reader
 * semantics, and correct pointer capture — including drags that leave the
 * element — for free, all of which a hand-rolled slider has to reimplement.
 *
 * The visual track is a gradient driven by the value, since the native track
 * cannot be split into filled/unfilled halves cross-browser.
 */
export function SeekBar({ className }: { className?: string }): JSX.Element {
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const trackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);
  const hasTrack = usePlayerStore((s) => s.queue.length > 0);

  const { beginScrub, endScrub } = usePlayerControls();

  /**
   * While dragging we render a local value instead of the store's.
   *
   * The engine's rAF loop is suspended during a scrub, but the thumb still needs
   * to follow the pointer — so the component owns the value until release.
   */
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  // Abandon an in-flight scrub if the track changes underneath it.
  useEffect(() => {
    setScrubValue(null);
  }, [trackId]);

  const max = duration > 0 ? duration : 0;
  const displayed = scrubValue ?? position;
  const percent = max > 0 ? Math.min((displayed / max) * 100, 100) : 0;

  const commit = (value: number): void => {
    endScrub(value);
    setScrubValue(null);
  };

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
        {formatTime(displayed)}
      </span>

      <div className="group relative flex h-3 w-full items-center">
        {/* Visual track. The input sits on top, transparent. */}
        <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-colors group-hover:bg-accent"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Thumb: hidden until hover/focus, matching Spotify. */}
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ left: `${percent}%` }}
        />

        <input
          type="range"
          min={0}
          max={max || 100}
          step={0.1}
          value={displayed}
          disabled={!hasTrack || max === 0}
          aria-label="Seek"
          aria-valuetext={`${formatTime(displayed)} of ${formatTime(max)}`}
          onPointerDown={beginScrub}
          onKeyDown={beginScrub}
          onChange={(event) => setScrubValue(Number(event.target.value))}
          // Commit on release. `onChange` alone is not enough: it fires
          // continuously during the drag, and seeking on every frame would issue
          // a range request per pixel moved.
          onPointerUp={(event) => commit(Number(event.currentTarget.value))}
          onKeyUp={(event) => commit(Number(event.currentTarget.value))}
          // Pointer leaving the window mid-drag must not leave the loop frozen.
          onPointerCancel={(event) => commit(Number(event.currentTarget.value))}
          onBlur={() => {
            if (scrubValue !== null) commit(scrubValue);
          }}
          className="focus-ring absolute inset-x-0 h-3 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
        />
      </div>

      <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted">{formatTime(max)}</span>
    </div>
  );
}
