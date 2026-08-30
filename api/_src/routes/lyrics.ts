import { Router } from 'express';
import type { Lyrics } from '../../../shared/types.js';
import { ApiError } from '../lib/errors.js';
import { ok } from '../lib/respond.js';
import { callOptional } from '../lib/saavnClient.js';
import { asRecord, decodeEntities, toStringOrNull } from '../lib/text.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const lyricsRouter = Router();

/**
 * GET /api/lyrics/:songId — plain-text lyrics.
 *
 * Two verified quirks shape this route:
 *
 * 1. The upstream parameter is named `lyrics_id` but expects the **song id**.
 *    `more_info.lyrics_id` does not exist on song payloads at all, so the song
 *    id is the only usable key.
 *
 * 2. The `has_lyrics` flag is NOT a reliable gate. For song `aRZbUYD7`,
 *    `song.getDetails` reports `"false"` while lyrics genuinely exist. So this
 *    route always attempts the fetch and lets the result decide.
 *
 * Missing lyrics return **200 with `lyrics: null`**, not 404: roughly half of
 * all tracks have none, and that is a normal outcome the UI shows as a neutral
 * empty state rather than an error (requirement R7.3).
 */
lyricsRouter.get(
  '/:songId',
  asyncHandler(async (req, res) => {
    const songId = String(req.params['songId'] ?? '').trim();
    if (songId.length === 0) throw ApiError.badRequest('A song id is required');

    // `callOptional`: upstream answers HTTP 200 with a failure body when a track
    // has no lyrics, which is expected rather than exceptional.
    const payload = await callOptional<unknown>('lyrics.getLyrics', { lyrics_id: songId });
    const root = asRecord(payload);

    const raw = toStringOrNull(root['lyrics']);

    const result: Lyrics = {
      songId,
      // Upstream delimits lines with literal `<br>`; convert to newlines here so
      // no component has to parse HTML. There is no timing data in this payload,
      // which is why the UI is a static panel rather than karaoke highlighting.
      lyrics: raw === null ? null : decodeEntities(raw.replace(/<br\s*\/?>/gi, '\n')) || null,
      copyright: toStringOrNull(root['lyrics_copyright']),
      snippet: toStringOrNull(root['snippet']),
    };

    // Lyrics are immutable once published — cache them longer than metadata.
    return ok(res, result, 3600);
  }),
);
