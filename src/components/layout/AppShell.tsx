import { Outlet } from 'react-router-dom';
import { PlayerBar } from '@/components/player/PlayerBar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Persistent application chrome.
 *
 * The router `Outlet` is the ONLY part that swaps on navigation. Sidebar,
 * Topbar and PlayerBar live outside it, so navigating never unmounts the audio
 * element — a remount would restart playback.
 *
 * Layout is a fixed-height flex shell with exactly one scroll container (the
 * `<main>`), which keeps the player bar pinned without `position: fixed` and its
 * attendant z-index and safe-area problems.
 */
export function AppShell(): JSX.Element {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-black">
      <div className="flex min-h-0 flex-1 gap-2 p-0 md:p-2">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-y-auto rounded-none bg-gradient-to-b from-[#1c1c1c] to-base md:rounded-card">
          <Topbar />
          <div className="px-4 pb-10 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>

      <PlayerBar />
    </div>
  );
}
