import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { usePlayerEngine } from '@/hooks/usePlayer';
import { Home } from '@/pages/Home';
import {
  ArtistPage,
  CollectionPage,
  LibraryPage,
  LikedSongsPage,
  NotFoundPage,
  SearchPage,
} from '@/pages/StagePlaceholder';

/**
 * Application root.
 *
 * `usePlayerEngine()` is mounted HERE, once, above the router. It owns the
 * single `<audio>` element; mounting it inside a routed page would tear down and
 * restart playback on every navigation.
 *
 * Routes are nested under `AppShell` so the sidebar, top bar and player bar
 * persist across navigation and only the outlet swaps.
 */
export function App(): JSX.Element {
  usePlayerEngine();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/album/:id" element={<CollectionPage kind="album" />} />
        <Route path="/playlist/:id" element={<CollectionPage kind="playlist" />} />
        <Route path="/artist/:id" element={<ArtistPage />} />
        <Route path="/liked" element={<LikedSongsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
