import { useAnalyserLevels } from '@/hooks/usePlayer';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

/**
 * Equalizer bars driven by real audio amplitude.
 *
 * `useAnalyserLevels` reads an `AnalyserNode` fed by the actually-playing
 * element, so these bars reflect the music rather than a canned CSS animation
 * (requirement R9.1). Heights are written to `style` because the values are
 * continuous — a Tailwind class per height is not possible.
 *
 * When the visualiser is unavailable (no Web Audio, or a CORS-tainted element)
 * the hook returns zeros and the bars sit flat, which is the intended graceful
 * degradation rather than an error state.
 */
export function Equalizer({
  barCount = 4,
  className,
}: {
  barCount?: number;
  className?: string;
}): JSX.Element {
  const levels = useAnalyserLevels(barCount);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <div
      className={cn('flex h-4 items-end gap-[2px]', className)}
      aria-hidden="true"
      title={isPlaying ? 'Audio levels' : 'Paused'}
    >
      {levels.map((level, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full transition-[height] duration-75 ease-out',
            isPlaying ? 'bg-accent' : 'bg-white/30',
          )}
          style={{
            // Floor keeps a flat baseline when idle rather than collapsing to
            // nothing. At 10% the 3px-wide bars rendered as dots, so the idle
            // state now reads as short bars.
            height: `${Math.max(level * 100, 18)}%`,
          }}
        />
      ))}
    </div>
  );
}
