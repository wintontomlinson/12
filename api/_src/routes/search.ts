import { Router } from 'express';
import type {
  Album,
  ArtistCard,
  Playlist,
  SearchResults,
  SearchSuggestions,
  Song,
} from '../../../shared/types.js';
import { ApiError } from '../lib/errors.js';
import { ok } from '../lib/respond.js';
import { call, callOptional } from '../lib/saavnClient.js';
import { asArray, asRecord, toInt } from '../lib/text.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeAlbum } from '../normalizers/album.js';
import { normalizeArtistCard } from '../normalizers/artist.js';
import { normalizeEntity } from '../normalizers/entity.js';
import { normalizePlaylist } from '../normalizers/playlist.js';
import { normalizeSong } from '../normalizers/song.js';

export const searchRouter = Router();

const MAX_LIMIT = 40;

function requireQuery(raw: unknown): string {
  const query = typeof raw === 'string' ? raw.trim() : '';
  if (query.length === 0) {
    throw ApiError.badRequest('Query parameter "q" is required');
  }
  return query;
}

function clampLimit(raw: unknown, fallback: number): number {
  const limit = toInt(raw, fallback);
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

/** Pulls a bucket out of `autocomplete.get`, which nests each under `.data`. */
function suggestBucket(root: Record<string, unknown>, key: string): unknown[] {
  return asArray(asRecord(root[key])['data']);
}

/**
 * GET /api/search/suggest?q= — compact grouped payload for the navbar.
 *
 * Uses `autocomplete.get` rather than the full search endpoints because it
 * answers in one round trip with all four entity groups, which matters for a
 * per-keystroke request.
 */
searchRouter.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const query = requireQuery(req.query['q']);
    const limit = clampLimit(req.query['limit'], 5);

    const payload = await call<Record<string, unknown>>('autocomplete.get', { query });
    const root = asRecord(payload);

    // `topquery` is upstream's own best guess and may be any entity type, so it
    // goes through the polymorphic normalizer.
    const topRaw = suggestBucket(root, 'topquery')[0];
    const top = topRaw === undefined ? null : normalizeEntity(topRaw);

    const suggestions: SearchSuggestions = {
      query,
      top,
      songs: suggestBucket(root, 'songs').slice(0, limit).map(normalizeSong),
      albums: suggestBucket(root, 'albums').slice(0, limit).map(normalizeAlbum),
      artists: suggestBucket(root, 'artists').slice(0, limit).map(normalizeArtistCard),
      playlists: suggestBucket(root, 'playlists').slice(0, limit).map(normalizePlaylist),
    };

    return ok(res, suggestions, 60);
  }),
);

/**
 * GET /api/search?q=&type=&page=&limit=
 *
 * `type=all` (default) fans out to all four upstream searches concurrently and
 * tolerates partial failure, so one dead category still yields a useful page.
 */
searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = requireQuery(req.query['q']);
    const type = String(req.query['type'] ?? 'all');
    const page = Math.max(toInt(req.query['page'], 1), 1);
    const limit = clampLimit(req.query['limit'], 20);

    const params = { q: query, p: page, n: limit };

    // `results` on the song endpoint, `results` on the others too — but the
    // envelope differs per call, so each is read defensively.
    const readResults = (payload: unknown): unknown[] => asArray(asRecord(payload)['results']);

    if (type === 'song' || type === 'album' || type === 'artist' || type === 'playlist') {
      const single = await call<unknown>(UPSTREAM_CALL[type], params);
      const results: SearchResults = {
        query,
        songs: type === 'song' ? readResults(single).map(normalizeSong) : [],
        albums: type === 'album' ? readResults(single).map(normalizeAlbum) : [],
        artists: type === 'artist' ? readResults(single).map(normalizeArtistCard) : [],
        playlists: type === 'playlist' ? readResults(single).map(normalizePlaylist) : [],
      };
      return ok(res, results, 60);
    }

    if (type !== 'all') {
      throw ApiError.badRequest(
        'Query parameter "type" must be one of: all, song, album, artist, playlist',
      );
    }

    // Concurrent fan-out. `callOptional` degrades a failed category to null
    // rather than failing the whole search.
    const [songs, albums, artists, playlists] = await Promise.all([
      callOptional<unknown>(UPSTREAM_CALL.song, params),
      callOptional<unknown>(UPSTREAM_CALL.album, params),
      callOptional<unknown>(UPSTREAM_CALL.artist, params),
      callOptional<unknown>(UPSTREAM_CALL.playlist, params),
    ]);

    // If every category failed, the upstream is down — report it instead of
    // pretending there were no matches.
    if (songs === null && albums === null && artists === null && playlists === null) {
      throw ApiError.upstream(`Search for "${query}" failed across all categories`);
    }

    const results: SearchResults = {
      query,
      songs: readResults(songs).map(normalizeSong) as Song[],
      albums: readResults(albums).map(normalizeAlbum) as Album[],
      artists: readResults(artists).map(normalizeArtistCard) as ArtistCard[],
      playlists: readResults(playlists).map(normalizePlaylist) as Playlist[],
    };

    return ok(res, results, 60);
  }),
);

const UPSTREAM_CALL = {
  song: 'search.getResults',
  album: 'search.getAlbumResults',
  artist: 'search.getArtistResults',
  playlist: 'search.getPlaylistResults',
} as const;
