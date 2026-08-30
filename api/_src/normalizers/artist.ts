import type { ArtistRef, ArtistCard, Artist } from '../../../shared/types.js';
import {
  asArray,
  asRecord,
  decodeEntities,
  pickImage,
  toBoolean,
  toNumber,
  toStringOrNull,
} from '../lib/text.js';

/**
 * Normalizes one entry from an `artistMap` bucket or a search result.
 */
export function normalizeArtistRef(raw: unknown): ArtistRef | null {
  const record = asRecord(raw);
  const id = toStringOrNull(record['id']);
  const name = decodeEntities(record['name'] ?? record['title']);

  if (id === null || name === '') return null;

  return {
    id,
    name,
    image: pickImage(record['image']),
    role: toStringOrNull(record['role']),
  };
}

/**
 * Flattens `more_info.artistMap` into a deduplicated, ordered artist list.
 *
 * The map has three overlapping buckets — `primary_artists`, `featured_artists`
 * and `artists` — and the same person routinely appears in several. Order is
 * preserved (primary first, so `artists[0]` is the lead) and duplicates are
 * dropped by id, keeping the first occurrence because that carries the most
 * specific role.
 */
export function normalizeArtistMap(rawMap: unknown): ArtistRef[] {
  const map = asRecord(rawMap);
  const buckets = [map['primary_artists'], map['featured_artists'], map['artists']];

  const seen = new Set<string>();
  const artists: ArtistRef[] = [];

  for (const bucket of buckets) {
    for (const entry of asArray(bucket)) {
      const artist = normalizeArtistRef(entry);
      if (artist === null || seen.has(artist.id)) continue;
      seen.add(artist.id);
      artists.push(artist);
    }
  }
  return artists;
}

/** Carousel/search shape: identity only, no nested collections. */
export function normalizeArtistCard(raw: unknown): ArtistCard {
  const record = asRecord(raw);
  const more = asRecord(record['more_info']);

  return {
    type: 'artist',
    id: toStringOrNull(record['id']) ?? toStringOrNull(record['artistId']) ?? '',
    name: decodeEntities(record['name'] ?? record['title']),
    image: pickImage(record['image']),
    url: toStringOrNull(record['perma_url']),
    followerCount: toNumber(more['follower_count'] ?? record['follower_count']),
    isVerified: toBoolean(record['isVerified'] ?? more['is_verified']),
  };
}

/**
 * Full artist page from `artist.getArtistPageDetails`.
 *
 * Note this endpoint is the odd one out: it uses `artistId`/`name` at the top
 * level rather than the `id`/`title` used everywhere else, and nests its
 * collections under camelCase keys.
 *
 * Normalizers for songs and albums are injected to avoid a circular import
 * (album needs song, artist needs both).
 */
export function normalizeArtistPage(
  raw: unknown,
  deps: {
    normalizeSong: (raw: unknown) => import('../../../shared/types.js').Song;
    normalizeAlbum: (raw: unknown) => import('../../../shared/types.js').Album;
  },
): Artist {
  const record = asRecord(raw);

  return {
    type: 'artist',
    id: toStringOrNull(record['artistId']) ?? toStringOrNull(record['id']) ?? '',
    name: decodeEntities(record['name'] ?? record['title']),
    image: pickImage(record['image']),
    url: toStringOrNull(record['perma_url']) ?? toStringOrNull(record['urls']),
    followerCount: toNumber(record['follower_count']),
    isVerified: toBoolean(record['isVerified']),
    bio: normalizeBio(record['bio']),
    dominantLanguage: toStringOrNull(record['dominantLanguage']),
    dominantType: toStringOrNull(record['dominantType']),
    topSongs: asArray(record['topSongs']).map(deps.normalizeSong),
    topAlbums: asArray(record['topAlbums']).map(deps.normalizeAlbum),
    singles: asArray(record['singles']).map(deps.normalizeAlbum),
    similarArtists: asArray(record['similarArtists'])
      .map(normalizeArtistRef)
      .filter((a): a is ArtistRef => a !== null),
  };
}

/**
 * `bio` arrives either as a JSON-encoded string or an array of
 * `{ title, text, sequence }` sections. Both collapse to plain text.
 */
function normalizeBio(raw: unknown): string | null {
  const sections = typeof raw === 'string' ? safeParseArray(raw) : asArray(raw);

  const text = sections
    .map((section) => decodeEntities(asRecord(section)['text']))
    .filter((part) => part.length > 0)
    .join('\n\n');

  return text.length > 0 ? text : null;
}

function safeParseArray(raw: string): unknown[] {
  if (raw.trim().length === 0) return [];
  try {
    return asArray(JSON.parse(raw));
  } catch {
    // A bare bio string rather than JSON.
    return [{ text: raw }];
  }
}
