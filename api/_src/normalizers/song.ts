import type { AlbumRef, Song } from '../../../shared/types.js';
import { buildDownloadLinks } from '../lib/des.js';
import {
  asRecord,
  decodeEntities,
  pickImage,
  toBoolean,
  toExplicit,
  toInt,
  toNumber,
  toStringOrNull,
} from '../lib/text.js';
import { normalizeArtistMap } from './artist.js';

/**
 * Normalizes a song from any endpoint.
 *
 * Works uniformly across `song.getDetails`, album/playlist tracklists and
 * carousel entries, because all of them use the same
 * `{ ...identity, more_info: {...} }` envelope for tracks.
 */
export function normalizeSong(raw: unknown): Song {
  const record = asRecord(raw);
  const more = asRecord(record['more_info']);

  const artists = normalizeArtistMap(more['artistMap']);

  // Fall back to the `music` credit when artistMap is absent (happens on some
  // lean carousel payloads) so the UI still has a name to show.
  const artistNames =
    artists.length > 0
      ? artists.map((artist) => artist.name).join(', ')
      : decodeEntities(more['music'] ?? record['subtitle']);

  return {
    type: 'song',
    id: toStringOrNull(record['id']) ?? '',
    title: decodeEntities(record['title'] ?? record['song']),
    subtitle: decodeEntities(record['subtitle']),
    url: toStringOrNull(record['perma_url']),
    image: pickImage(record['image']),

    // Upstream sends duration as a string of seconds.
    duration: toInt(more['duration'] ?? record['duration'], 0),

    album: normalizeAlbumRef(record, more),
    artists,
    artistNames,

    year: toStringOrNull(record['year']),
    language: toStringOrNull(record['language']),
    playCount: toNumber(record['play_count']),
    explicit: toExplicit(record['explicit_content']),

    /**
     * A HINT ONLY — never gate a lyrics request on this.
     *
     * Verified inconsistent across endpoints: for song `aRZbUYD7`,
     * `song.getDetails` reports `"false"` while `playlist.getDetails` reports
     * `"true"`, and `lyrics.getLyrics` returns real lyrics either way. The
     * lyrics route therefore always attempts the fetch.
     */
    hasLyrics: toBoolean(more['has_lyrics']),

    label: toStringOrNull(more['label']),

    // Empty array when decryption failed — callers must not assume [0] exists.
    downloadUrl: buildDownloadLinks(more['encrypted_media_url']),
  };
}

function normalizeAlbumRef(
  record: Record<string, unknown>,
  more: Record<string, unknown>,
): AlbumRef | null {
  const id = toStringOrNull(more['album_id'] ?? record['albumid']);
  const name = decodeEntities(more['album'] ?? record['album']);

  if (id === null && name === '') return null;

  return {
    id: id ?? '',
    name,
    url: toStringOrNull(more['album_url']),
  };
}
