import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { usePlayerEngine } from '@/hooks/usePlayer';
import { Artist } from '@/pages/Artist';
import { Collection } from '@/pages/Collection';
import { Home } from '@/pages/Home';
import { Library } from '@/pages/Library';
import { LikedSongs } from '@/pages/LikedSongs';
import { NotFound } from '@/pages/NotFound';
import { Search } from '@/pages/Search';

/**
 * Application root.
 *
 * `usePlayerEngine()` is mounted HERE, once, above the router. It owns the
 * single `<audio>` element; mounting it inside a routed page would tear down and
 * restart playback on every navigation.
 *
 * Routes are nested under `AppShell` so the sidebar, top bar, side panels and
 * player bar persist across navigation and only the outlet swaps.
 */
export function App(): JSX.Element {
  usePlayerEngine();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        {/* Album and playlist share one component; the payloads differ only in
            a couple of fields and the page layout is identical. */}
        <Route path="/album/:id" element={<Collection kind="album" />} />
        <Route path="/playlist/:id" element={<Collection kind="playlist" />} />
        <Route path="/artist/:id" element={<Artist />} />
        <Route path="/liked" element={<LikedSongs />} />
        <Route path="/library" element={<Library />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
