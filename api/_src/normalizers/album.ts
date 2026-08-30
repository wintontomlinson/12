import type { Album } from '../../../shared/types.js';
import {
  asArray,
  asRecord,
  decodeEntities,
  pickImage,
  toExplicit,
  toInt,
  toNumber,
  toStringOrNull,
} from '../lib/text.js';
import { normalizeArtistMap, normalizeArtistRef } from './artist.js';
import { normalizeSong } from './song.js';
import type { ArtistRef } from '../../../shared/types.js';

/**
 * Normalizes an album from `content.getAlbumDetails`, search results, or a
 * carousel entry.
 *
 * `songs` is only populated by the detail endpoint; lightweight payloads yield
 * an empty array rather than a missing key, so consumers can always map over it.
 */
export function normalizeAlbum(raw: unknown): Album {
  const record = asRecord(raw);
  const more = asRecord(record['more_info']);

  const songs = asArray(record['list']).map(normalizeSong);
  const artists = resolveArtists(record, more, songs);

  return {
    type: 'album',
    id: toStringOrNull(record['id']) ?? toStringOrNull(record['albumid']) ?? '',
    title: decodeEntities(record['title']),
    subtitle: decodeEntities(record['subtitle']),
    url: toStringOrNull(record['perma_url']),
    image: pickImage(record['image']),
    year: toStringOrNull(record['year']) ?? toStringOrNull(more['year']),
    language: toStringOrNull(record['language']) ?? toStringOrNull(more['language']),
    playCount: toNumber(record['play_count']),
    explicit: toExplicit(record['explicit_content']),

    /**
     * Track count. `list_count` is unreliable on detail payloads — the sampled
     * album reported `list_count: "0"` while carrying a populated `list` — so a
     * materialised tracklist always wins.
     */
    songCount: songs.length > 0 ? songs.length : toInt(more['song_count'] ?? record['list_count'], 0),

    artists,
    artistNames: artists.map((artist) => artist.name).join(', '),
    description: toStringOrNull(record['header_desc']),
    songs,
  };
}

/**
 * Album credits come from whichever of three places is populated:
 * `more_info.artistMap`, a flat `more_info.artists` list, or — failing both —
 * the first track's credits, which is the only source on some search payloads.
 */
function resolveArtists(
  record: Record<string, unknown>,
  more: Record<string, unknown>,
  songs: ReturnType<typeof normalizeSong>[],
): ArtistRef[] {
  const fromMap = normalizeArtistMap(more['artistMap']);
  if (fromMap.length > 0) return fromMap;

  const flat = asArray(more['artists'] ?? record['artists'])
    .map(normalizeArtistRef)
    .filter((artist): artist is ArtistRef => artist !== null);
  if (flat.length > 0) return dedupeById(flat);

  const firstSong = songs[0];
  return firstSong ? firstSong.artists : [];
}

function dedupeById(artists: ArtistRef[]): ArtistRef[] {
  const seen = new Set<string>();
  return artists.filter((artist) => {
    if (seen.has(artist.id)) return false;
    seen.add(artist.id);
    return true;
  });
}
