import { usePlayerStore } from '@/store/usePlayerStore';
import { VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Mute toggle plus a volume slider.
 *
 * Same native-range approach as the seek bar, for the same reasons: free
 * keyboard support and correct pointer capture. No scrub state is needed here
 * because volume applies instantly and has no cost per change.
 */
export function VolumeControl({ className }: { className?: string }): JSX.Element {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const effective = isMuted ? 0 : volume;
  const percent = effective * 100;

  const Icon = effective === 0 ? VolumeMuteIcon : effective < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={toggleMute}
        className="focus-ring rounded text-muted transition-colors hover:text-white"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        aria-pressed={isMuted}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>

      <div className="group relative flex h-3 w-24 items-center">
        <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-colors group-hover:bg-accent"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ left: `${percent}%` }}
        />

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          aria-label="Volume"
          aria-valuetext={`${Math.round(percent)}%`}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="focus-ring absolute inset-x-0 h-3 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
        />
      </div>
    </div>
  );
}
