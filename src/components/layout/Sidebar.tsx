import { NavLink, useLocation } from 'react-router-dom';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useUiStore } from '@/store/useUiStore';
import { cn } from '@/lib/utils';
import {
  CloseIcon,
  HeartIcon,
  HomeIcon,
  LibraryIcon,
  MusicNoteIcon,
  SearchIcon,
} from '@/components/ui/icons';

/**
 * Left navigation.
 *
 * On desktop it is a static column. On mobile it becomes an off-canvas drawer
 * (requirement L1) driven by `useUiStore`, with a backdrop that closes it.
 */
export function Sidebar(): JSX.Element {
  const isOpen = useUiStore((s) => s.isSidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  const likedCount = useLibraryStore((s) => s.likedSongs.length);
  const recentPlaylists = useLibraryStore((s) => s.recentlyPlayed);
  const location = useLocation();

  // Navigating should dismiss the drawer, otherwise it covers the page just
  // navigated to.
  const handleNavigate = (): void => closeSidebar();

  return (
    <>
      {/* Mobile backdrop. Desktop never renders it because the drawer is static. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'z-50 flex w-[240px] shrink-0 flex-col gap-2 bg-black p-2 transition-transform duration-300',
          // Off-canvas on mobile, in-flow on desktop.
          'fixed inset-y-0 left-0 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between rounded-card bg-surface px-4 py-4">
          <NavLink
            to="/"
            onClick={handleNavigate}
            className="focus-ring flex items-center gap-2 rounded"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-black">
              <MusicNoteIcon className="h-4 w-4" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">Sur</span>
          </NavLink>

          <button
            type="button"
            onClick={closeSidebar}
            className="focus-ring rounded p-1 text-muted hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="rounded-card bg-surface px-2 py-3">
          <ul className="space-y-1">
            <li>
              <SidebarLink to="/" label="Home" onNavigate={handleNavigate}>
                {({ active }) => <HomeIcon filled={active} className="h-[22px] w-[22px]" />}
              </SidebarLink>
            </li>
            <li>
              <SidebarLink to="/search" label="Search" onNavigate={handleNavigate}>
                {() => <SearchIcon className="h-[22px] w-[22px]" />}
              </SidebarLink>
            </li>
            <li>
              <SidebarLink to="/library" label="Your Library" onNavigate={handleNavigate}>
                {() => <LibraryIcon className="h-[22px] w-[22px]" />}
              </SidebarLink>
            </li>
          </ul>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface">
          <NavLink
            to="/liked"
            onClick={handleNavigate}
            className={cn(
              'focus-ring m-2 flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-hover',
              location.pathname === '/liked' && 'bg-surface-hover',
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-gradient-to-br from-accent to-accent-muted text-black">
              <HeartIcon filled className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">Liked Songs</span>
              <span className="block text-xs text-muted">
                {likedCount === 0
                  ? 'No songs yet'
                  : `${likedCount} ${likedCount === 1 ? 'song' : 'songs'}`}
              </span>
            </span>
          </NavLink>

          <div className="mx-4 mb-2 border-t border-white/5 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Recently played
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {recentPlaylists.length === 0 ? (
              <p className="px-2 text-xs leading-relaxed text-muted">
                Songs you play will show up here.
              </p>
            ) : (
              <ul className="space-y-1">
                {recentPlaylists.slice(0, 12).map((song) => (
                  <li key={song.id}>
                    <div className="flex items-center gap-3 rounded-md p-2 text-left">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-raised">
                        {song.image && (
                          <img src={song.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-white">{song.title}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {song.artistNames}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * Nav item that exposes its own active state to the icon.
 *
 * A render-prop child is used so the icon can switch between filled and outline
 * variants, which `NavLink`'s own `className` callback cannot reach.
 */
function SidebarLink({
  to,
  label,
  onNavigate,
  children,
}: {
  to: string;
  label: string;
  onNavigate: () => void;
  children: (state: { active: boolean }) => React.ReactNode;
}): JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'focus-ring flex items-center gap-4 rounded px-2 py-2 text-sm font-semibold transition-colors',
          isActive ? 'text-white' : 'text-muted hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {children({ active: isActive })}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
