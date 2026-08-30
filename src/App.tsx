import { useEffect, useState } from 'react';
import type { Album, Song } from '@shared/types';
import { PlayerBar } from '@/components/player/PlayerBar';
import { usePlayerEngine } from '@/hooks/usePlayer';
import { usePlayerStore } from '@/store/usePlayerStore';
import { apiFetch } from '@/lib/api';
import { formatTime } from '@/lib/utils';
import { PlayIcon } from '@/components/ui/icons';

/**
 * App shell.
 *
 * `usePlayerEngine()` is mounted HERE, once, above everything else. It owns the
 * single `<audio>` element; mounting it inside a routed page would tear down and
 * restart playback on every navigation.
 */
export function App(): JSX.Element {
  usePlayerEngine();

  return (
    <div className="flex h-full flex-col bg-base">
      <main className="flex-1 overflow-y-auto">
        <PlayerBarHarness />
      </main>
      <PlayerBar />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ *
 *  TEMPORARY REVIEW HARNESS
 *
 *  Exists only so the PlayerBar can be exercised at this checkpoint. It is
 *  replaced wholesale by the real sidebar/navbar/Home carousels in Stage 3.
 *  Nothing else imports it.
 * ════════════════════════════════════════════════════════════════════════ */

const DEMO_ALBUM_ID = '1139549';

function PlayerBarHarness(): JSX.Element {
  const [album, setAlbum] = useState<Album | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playQueue = usePlayerStore((s) => s.playQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const currentId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Album>(`/albums/${DEMO_ALBUM_ID}`)
      .then((data) => {
        if (!cancelled) setAlbum(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Request failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-10">
      <div className="mb-6 rounded-card border border-yellow-500/25 bg-yellow-500/5 px-4 py-3 text-xs text-yellow-200/80">
        <strong className="font-semibold">Temporary review harness.</strong> Loads one album so the
        player bar can be driven. Replaced by the real Home page in Stage 3.
      </div>

      {error && (
        <p className="rounded-card bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {!album && !error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" />
          ))}
        </div>
      )}

      {album && (
        <>
          <header className="mb-6 flex items-end gap-4">
            {album.image && (
              <img src={album.image} alt="" className="h-28 w-28 rounded-card shadow-lg" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Album</p>
              <h1 className="text-2xl font-extrabold sm:text-4xl">{album.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {album.artistNames} · {album.year} · {album.songCount} songs
              </p>
            </div>
          </header>

          <button
            type="button"
            onClick={() => playQueue(album.songs, 0)}
            className="focus-ring mb-4 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105"
          >
            <PlayIcon className="h-4 w-4" /> Play album
          </button>

          <ol className="divide-y divide-white/5">
            {album.songs.map((song: Song, index: number) => {
              const isCurrent = song.id === currentId;
              return (
                <li
                  key={song.id}
                  className="group flex items-center gap-3 py-2 pr-2 text-sm hover:bg-white/5"
                >
                  <span className="w-6 text-right text-xs text-muted">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => playQueue(album.songs, index)}
                    className="focus-ring min-w-0 flex-1 text-left"
                  >
                    <span className={isCurrent ? 'text-accent' : 'text-white'}>{song.title}</span>
                    <span className="block truncate text-xs text-muted">{song.artistNames}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addToQueue(song)}
                    className="focus-ring rounded px-2 py-1 text-[11px] text-muted opacity-0 transition hover:text-white group-hover:opacity-100"
                  >
                    + Queue
                  </button>
                  <span className="w-10 text-right text-xs tabular-nums text-muted">
                    {formatTime(song.duration)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
