import { Router } from 'express';
import type { Song } from '../../../shared/types.js';
import { ApiError } from '../lib/errors.js';
import { lookupById } from '../lib/lookup.js';
import { ok } from '../lib/respond.js';
import { asArray, asRecord } from '../lib/text.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeSong } from '../normalizers/song.js';

export const songsRouter = Router();

/**
 * GET /api/songs/:id — full song detail including decrypted playback URLs.
 *
 * Accepts a comma-separated list of ids, mirroring the upstream `pids`
 * parameter, so the client can refresh several tracks in one request.
 */
songsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params['id'] ?? '').trim();
    if (id.length === 0) throw ApiError.badRequest('A song id is required');

    const payload = await lookupById<unknown>(
      'song.getDetails',
      { pids: id },
      `No song found for id "${id}"`,
    );

    // The envelope varies: `{ songs: [...] }` normally, but a bare
    // `{ "<id>": {...} }` map on some ids.
    const root = asRecord(payload);
    const list = asArray(root['songs']);
    const raw = list.length > 0 ? list : Object.values(root).filter(isSongLike);

    const songs = raw.map(normalizeSong).filter((song) => song.id !== '');

    if (songs.length === 0) {
      throw ApiError.notFound(`No song found for id "${id}"`);
    }

    // Single id → single object; multiple ids → array. Keeps the common case
    // ergonomic for the client.
    const requestedMultiple = id.includes(',');
    return ok<Song | Song[]>(res, requestedMultiple ? songs : (songs[0] as Song), 300);
  }),
);

function isSongLike(value: unknown): boolean {
  const record = asRecord(value);
  return record['type'] === 'song' && typeof record['id'] === 'string';
}
