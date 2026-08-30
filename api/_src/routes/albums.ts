import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { lookupById } from '../lib/lookup.js';
import { ok } from '../lib/respond.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeAlbum } from '../normalizers/album.js';

export const albumsRouter = Router();

/**
 * GET /api/albums/:id — album header plus full tracklist.
 *
 * Every track carries its own decrypted `downloadUrl`, so playing an album
 * requires no follow-up per-song requests.
 */
albumsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params['id'] ?? '').trim();
    if (id.length === 0) throw ApiError.badRequest('An album id is required');

    const payload = await lookupById<unknown>(
      'content.getAlbumDetails',
      { albumid: id },
      `No album found for id "${id}"`,
    );
    const album = normalizeAlbum(payload);

    // The upstream can answer 200 with an empty shell for an unknown id, so an
    // absent identity is treated as a genuine 404.
    if (album.id === '' && album.title === '') {
      throw ApiError.notFound(`No album found for id "${id}"`);
    }

    return ok(res, album, 600);
  }),
);
