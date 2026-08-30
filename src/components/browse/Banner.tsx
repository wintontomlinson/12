import { cn } from '@/lib/utils';
import { MusicNoteIcon, UserIcon } from '@/components/ui/icons';

/**
 * Detail-page header: large artwork, type label, title, metadata.
 *
 * The gradient wash behind it is a fixed dark tint rather than a colour sampled
 * from the artwork. Extracting a dominant colour would need a canvas read of a
 * cross-origin image plus a contrast check to keep white text legible; a fixed
 * tint gets most of the visual effect with none of that risk.
 */
export function Banner({
  kind,
  title,
  image,
  meta,
  description,
  round = false,
  actions,
}: {
  kind: string;
  title: string;
  image: string | null;
  meta: React.ReactNode;
  description?: string | null;
  round?: boolean;
  actions?: React.ReactNode;
}): JSX.Element {
  return (
    <header className="relative -mx-4 mb-6 px-4 pb-6 pt-4 sm:-mx-6 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.10] to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
        <div
          className={cn(
            'h-44 w-44 shrink-0 overflow-hidden bg-surface-raised shadow-2xl shadow-black/60 sm:h-52 sm:w-52',
            round ? 'rounded-full' : 'rounded-card',
          )}
        >
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              {round ? <UserIcon className="h-16 w-16" /> : <MusicNoteIcon className="h-16 w-16" />}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{kind}</p>

          {/* Long titles scale down rather than wrapping into the artwork. */}
          <h1
            className={cn(
              'mt-2 break-words font-extrabold tracking-tight text-white',
              title.length > 40 ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-6xl',
            )}
          >
            {title}
          </h1>

          {description && (
            <p className="mt-3 line-clamp-2 max-w-prose text-sm text-muted">{description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
            {meta}
          </div>

          {actions && <div className="mt-5 flex items-center gap-4">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

/** Bullet separator for banner metadata. */
export function MetaDot(): JSX.Element {
  return <span className="text-white/40">•</span>;
}
