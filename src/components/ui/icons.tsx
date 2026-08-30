import type { SVGProps } from 'react';

/**
 * Inline SVG icons.
 *
 * Hand-rolled rather than pulling in an icon package: the player needs about a
 * dozen glyphs, and inlining them avoids shipping a library and keeps every
 * icon `currentColor`-driven so hover/active states are pure CSS.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M8 5.14v13.72a.5.5 0 0 0 .77.42l10.29-6.86a.5.5 0 0 0 0-.84L8.77 4.72A.5.5 0 0 0 8 5.14Z" />
    </Icon>
  );
}

export function PauseIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
    </Icon>
  );
}

export function NextIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M6 5.14v13.72a.5.5 0 0 0 .77.42l9-6a.5.5 0 0 0 0-.84l-9-6a.5.5 0 0 0-.77.42ZM17.5 4.5h2v15h-2z" />
    </Icon>
  );
}

export function PreviousIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M18 5.14v13.72a.5.5 0 0 1-.77.42l-9-6a.5.5 0 0 1 0-.84l9-6a.5.5 0 0 1 .77.42ZM4.5 4.5h2v15h-2z" />
    </Icon>
  );
}

export function ShuffleIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </Icon>
  );
}

/** Repeat-all: a loop with no marker. */
export function RepeatIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Icon>
  );
}

/** Repeat-one: the same loop with a "1" so the mode is distinguishable at a glance. */
export function RepeatOneIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
        1
      </text>
    </Icon>
  );
}

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }): JSX.Element {
  return filled ? (
    <Icon {...props}>
      <path d="M12 21s-7.5-4.7-9.3-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.3 12c-1.8 4.3-9.3 9-9.3 9Z" />
    </Icon>
  ) : (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.3S5 15.9 3.4 11.9A4.7 4.7 0 0 1 12 7.4a4.7 4.7 0 0 1 8.6 4.5c-1.6 4-8.6 8.4-8.6 8.4Z" />
    </Icon>
  );
}

export function LyricsIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h11M4 11h16M4 16h9" />
      <path d="M18 15.5a2.5 2.5 0 1 0 2.5 2.5V13" />
    </Icon>
  );
}

export function QueueIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h13M3 11h13M3 16h8" />
      <path d="M18 8v9" />
      <circle cx="20" cy="17" r="2" />
    </Icon>
  );
}

export function VolumeHighIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M11 4.7v14.6a.7.7 0 0 1-1.15.53L5.8 16.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2.8l4.05-3.33A.7.7 0 0 1 11 4.7Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M15.2 8.6a4.8 4.8 0 0 1 0 6.8M18 6a8.5 8.5 0 0 1 0 12"
      />
    </Icon>
  );
}

export function VolumeLowIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M11 4.7v14.6a.7.7 0 0 1-1.15.53L5.8 16.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2.8l4.05-3.33A.7.7 0 0 1 11 4.7Z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 8.6a4.8 4.8 0 0 1 0 6.8" />
    </Icon>
  );
}

export function VolumeMuteIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M11 4.7v14.6a.7.7 0 0 1-1.15.53L5.8 16.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2.8l4.05-3.33A.7.7 0 0 1 11 4.7Z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.5 9.5l5 5m0-5-5 5" />
    </Icon>
  );
}

export function FullscreenIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function MusicNoteIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M18 3v11.5a3.5 3.5 0 1 1-2-3.16V6.6l-6 1.2v8.7a3.5 3.5 0 1 1-2-3.16V6.2a1 1 0 0 1 .8-.98l8-1.6A1 1 0 0 1 18 3Z" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}


/* ── navigation / shell ─────────────────────────────────────────────────── */

export function HomeIcon({ filled = false, ...props }: IconProps & { filled?: boolean }): JSX.Element {
  return filled ? (
    <Icon {...props}>
      <path d="M12 3.2a1 1 0 0 1 .64.23l7 5.83A1 1 0 0 1 20 10v9a1.5 1.5 0 0 1-1.5 1.5H15a1 1 0 0 1-1-1v-4.75a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1V19.5a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19v-9a1 1 0 0 1 .36-.77l7-5.83A1 1 0 0 1 12 3.2Z" />
    </Icon>
  ) : (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.2 12 4l7.5 6.2V19a1 1 0 0 1-1 1h-4v-5.5h-5V20h-4a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function LibraryIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5v14M8.5 5v14" />
      <path d="m13.2 6.4 4.3-1.2a1 1 0 0 1 1.24.7l3 11.2a1 1 0 0 1-.7 1.23l-4.3 1.15a1 1 0 0 1-1.23-.7l-3-11.15a1 1 0 0 1 .7-1.23Z" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10 6 6 6-6 6" />
    </Icon>
  );
}

export function UserIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 12.6a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6ZM12 14.4c-3.6 0-6.6 2-6.6 4.4 0 .7.5 1.2 1.2 1.2h10.8c.7 0 1.2-.5 1.2-1.2 0-2.4-3-4.4-6.6-4.4Z" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}


/* ── track rows / menus / panels ────────────────────────────────────────── */

export function EllipsisIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </Icon>
  );
}

export function QueueAddIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h12M3 11h12M3 16h7" />
      <path d="M18 9v9M22.5 13.5h-9" transform="translate(-1.5 -1)" />
    </Icon>
  );
}

export function PlayNextIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h11M3 12h11M3 17h6" />
      <path d="m17 8 4 4-4 4" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </Icon>
  );
}

export function AlbumIcon(props: IconProps): JSX.Element {
  return (
    <Icon {...props} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  );
}

/** Animated "now playing" bars for the active row in a tracklist. */
export function PlayingBarsIcon({ className }: { className?: string }): JSX.Element {
  return (
    <span className={className} aria-label="Now playing" role="img">
      <span className="flex h-3.5 items-end justify-center gap-[2px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[2px] animate-pulse rounded-full bg-accent"
            style={{
              height: `${[60, 100, 45][i]}%`,
              animationDelay: `${i * 160}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </span>
    </span>
  );
}
