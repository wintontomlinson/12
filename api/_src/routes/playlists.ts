import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { lookupById } from '../lib/lookup.js';
import { ok } from '../lib/respond.js';
import { toInt } from '../lib/text.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizePlaylist } from '../normalizers/playlist.js';

export const playlistsRouter = Router();

/**
 * GET /api/playlists/:id — playlist header plus tracklist.
 *
 * `n` requests a track count up front; large editorial playlists are otherwise
 * truncated by the upstream default.
 */
playlistsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params['id'] ?? '').trim();
    if (id.length === 0) throw ApiError.badRequest('A playlist id is required');

    const limit = Math.min(Math.max(toInt(req.query['limit'], 100), 1), 200);

    const payload = await lookupById<unknown>(
      'playlist.getDetails',
      { listid: id, n: limit, p: 1 },
      `No playlist found for id "${id}"`,
    );
    const playlist = normalizePlaylist(payload);

    // An unknown id can yield a 200 shell with no title — treat that as absent.
    if (playlist.title === '') {
      throw ApiError.notFound(`No playlist found for id "${id}"`);
    }

    return ok(res, playlist, 600);
  }),
);
