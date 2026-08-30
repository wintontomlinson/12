import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { lookupById } from '../lib/lookup.js';
import { ok } from '../lib/respond.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalizeAlbum } from '../normalizers/album.js';
import { normalizeArtistPage } from '../normalizers/artist.js';
import { normalizeSong } from '../normalizers/song.js';

export const artistsRouter = Router();

/**
 * GET /api/artists/:id — artist page: bio, top songs, albums, singles, similar.
 */
artistsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params['id'] ?? '').trim();
    if (id.length === 0) throw ApiError.badRequest('An artist id is required');

    const payload = await lookupById<unknown>(
      'artist.getArtistPageDetails',
      { artistId: id },
      `No artist found for id "${id}"`,
    );

    // Song and album normalizers are injected to break what would otherwise be
    // a circular import between the artist and album modules.
    const artist = normalizeArtistPage(payload, { normalizeSong, normalizeAlbum });

    /**
     * Guard on NAME, not id.
     *
     * Verified: for an unknown artistId the upstream echoes the id back with an
     * empty `name`, a generic placeholder image and empty collections, at HTTP
     * 200. An id-based guard therefore never fires and we would serve a
     * nameless ghost artist page.
     */
    if (artist.name === '') {
      throw ApiError.notFound(`No artist found for id "${id}"`);
    }

    return ok(res, artist, 600);
  }),
);
