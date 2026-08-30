import type { Playlist } from '../../../shared/types.js';
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
import { normalizeSong } from './song.js';

/**
 * Normalizes a playlist from `playlist.getDetails`, search results, or a
 * carousel entry.
 *
 * Chart entries are the sparsest variant seen — `{ id, image, title, type,
 * count, perma_url, more_info: { firstname } }` — so every field beyond
 * identity must tolerate absence.
 */
export function normalizePlaylist(raw: unknown): Playlist {
  const record = asRecord(raw);
  const more = asRecord(record['more_info']);

  const songs = asArray(record['list']).map(normalizeSong);

  return {
    type: 'playlist',
    id: toStringOrNull(record['id']) ?? toStringOrNull(more['listid']) ?? '',
    title: decodeEntities(record['title'] ?? more['listname']),
    subtitle: decodeEntities(record['subtitle']),
    url: toStringOrNull(record['perma_url']),
    image: pickImage(record['image']),
    language: toStringOrNull(record['language']) ?? toStringOrNull(more['language']),
    explicit: toExplicit(record['explicit_content']),

    // Prefer a materialised tracklist; fall back through the several count
    // fields different endpoints use (`count` on chart entries).
    songCount:
      songs.length > 0
        ? songs.length
        : toInt(more['song_count'] ?? record['list_count'] ?? record['count'], 0),

    followerCount: toNumber(more['follower_count'] ?? more['fan_count']),
    description: toStringOrNull(record['header_desc']),
    songs,
  };
}
