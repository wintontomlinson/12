import { usePlayerStore, type QualityPreference } from '@/store/usePlayerStore';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { cn } from '@/lib/utils';

/**
 * Streaming quality selector.
 *
 * Shows what is ACTUALLY streaming, not just what was requested — those differ
 * whenever the engine downgrades after detecting rebuffering, and hiding that
 * would make the player look like it ignored the setting.
 */

const OPTIONS: ReadonlyArray<{ value: QualityPreference; label: string; hint: string }> = [
  { value: 'auto', label: 'Automatic', hint: 'Adapts to your connection' },
  { value: '320kbps', label: 'High — 320 kbps', hint: 'Best quality, ~10 MB per song' },
  { value: '160kbps', label: 'Normal — 160 kbps', hint: 'Balanced' },
  { value: '96kbps', label: 'Low — 96 kbps', hint: 'Fewest interruptions' },
];

/** Compact badge text, e.g. "160" or "320". */
function badge(quality: string | null): string {
  if (!quality) return '—';
  return quality.replace('kbps', '');
}

export function QualityControl({ className }: { className?: string }): JSX.Element {
  const preference = usePlayerStore((s) => s.qualityPreference);
  const effective = usePlayerStore((s) => s.effectiveQuality);
  const didAutoDowngrade = usePlayerStore((s) => s.didAutoDowngrade);
  const setQualityPreference = usePlayerStore((s) => s.setQualityPreference);

  const items: MenuItem[] = OPTIONS.map((option) => ({
    label: `${preference === option.value ? '✓ ' : ''}${option.label}`,
    onSelect: () => setQualityPreference(option.value),
  }));

  const title = didAutoDowngrade
    ? `Streaming at ${effective ?? '—'} — reduced from your setting to stop buffering`
    : `Streaming quality: ${effective ?? 'not playing'}`;

  return (
    <div className={cn('flex items-center', className)} title={title}>
      <span
        className={cn(
          'select-none rounded px-1 text-[10px] font-bold tabular-nums',
          // Amber signals "not what you asked for", so a downgrade is visible
          // rather than silent.
          didAutoDowngrade ? 'text-amber-400' : 'text-muted',
        )}
        aria-hidden="true"
      >
        {badge(effective)}
      </span>
      <Menu items={items} label="Streaming quality" />
    </div>
  );
}
