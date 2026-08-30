import type { Album, Artist, BrowseEntity, Playlist, Song } from '@shared/types';
import { apiFetch } from '@/lib/api';
import { usePlayerStore } from '@/store/usePlayerStore';

/**
 * Plays any browse entity.
 *
 * Carousels are heterogeneous — one section can contain songs, albums and
 * playlists at once — so "play this card" has to resolve per type:
 *
 *   • song     → already fully playable (its `downloadUrl` is populated).
 *   • album    → fetch the tracklist, then queue it.
 *   • playlist → fetch the tracklist, then queue it.
 *   • artist   → fetch the artist page and queue their top songs.
 *
 * Collection payloads already embed every track's decrypted URL, so playing an
 * album is exactly one request with no per-song follow-ups.
 */
export async function playEntity(entity: BrowseEntity, startIndex = 0): Promise<void> {
  const store = usePlayerStore.getState();

  try {
    switch (entity.type) {
      case 'song': {
        const playable = await resolveSong(entity);
        if (playable === null) {
          store.setStatus('error', `No playable audio found for “${entity.title}”.`);
          return;
        }
        store.playSong(playable);
        return;
      }

      case 'album': {
        // A carousel album carries no tracks; only the detail route returns them.
        const album = await apiFetch<Album>(`/albums/${entity.id}`);
        queueOrFail(album.songs, startIndex, album.title);
        return;
      }

      case 'playlist': {
        const playlist = await apiFetch<Playlist>(`/playlists/${entity.id}`);
        queueOrFail(playlist.songs, startIndex, playlist.title);
        return;
      }

      case 'artist': {
        const artist = await apiFetch<Artist>(`/artists/${entity.id}`);
        queueOrFail(artist.topSongs, startIndex, artist.name);
        return;
      }
    }
  } catch (cause) {
    store.setStatus(
      'error',
      cause instanceof Error ? cause.message : 'Could not start playback.',
    );
  }
}

/**
 * Guarantees a song has a playable URL, fetching full details if needed.
 *
 * Not every endpoint returns audio URLs. Verified: `autocomplete.get` — which
 * backs the navbar's live suggestions — omits `encrypted_media_url` and
 * `duration` entirely, so its songs arrive with `downloadUrl: []` and
 * `duration: 0`. Carousel songs from `getLaunchData` DO include them.
 *
 * Enriching suggestions server-side would cost one extra upstream call per
 * result on every keystroke, so resolution is deferred to the moment a user
 * actually picks a track. `/songs/:id` returns the decrypted URLs and the real
 * duration, which the seek bar also needs.
 */
async function resolveSong(song: Song): Promise<Song | null> {
  if (song.downloadUrl.length > 0) return song;
  if (song.id === '') return null;

  const detailed = await apiFetch<Song>(`/songs/${song.id}`);
  return detailed.downloadUrl.length > 0 ? detailed : null;
}

/**
 * Queues tracks, or reports why it could not.
 *
 * Two distinct empty cases are worth separating for the user: the collection has
 * no tracks at all, versus it has tracks but none of them yielded a playable URL
 * (DES decryption returns an empty `downloadUrl` rather than throwing).
 */
function queueOrFail(songs: Song[], startIndex: number, label: string): void {
  const store = usePlayerStore.getState();

  if (songs.length === 0) {
    store.setStatus('error', `“${label}” has no tracks.`);
    return;
  }

  const playable = songs.filter((song) => song.downloadUrl.length > 0);
  if (playable.length === 0) {
    store.setStatus('error', `No playable audio found for “${label}”.`);
    return;
  }

  // Re-map the requested index onto the filtered list so dropping an
  // unplayable track cannot shift playback onto the wrong song.
  const target = songs[startIndex];
  const remapped = target ? playable.findIndex((song) => song.id === target.id) : 0;

  store.playQueue(playable, remapped >= 0 ? remapped : 0);
}
