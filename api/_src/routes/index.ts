import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { albumsRouter } from './albums.js';
import { artistsRouter } from './artists.js';
import { homeRouter } from './home.js';
import { lyricsRouter } from './lyrics.js';
import { playlistsRouter } from './playlists.js';
import { searchRouter } from './search.js';
import { songsRouter } from './songs.js';

/**
 * Mounts every API route under a single router.
 *
 * Paths are declared WITHOUT the `/api` prefix. In production Vercel rewrites
 * `/api/*` to this function and the prefix is still present in `req.url`, so
 * `app.ts` mounts this router at `/api` to make local and deployed paths
 * identical.
 */
export const apiRouter = Router();

/** Liveness probe with no upstream dependency — distinguishes "our function is
 *  broken" from "JioSaavn is down" when debugging a deployment. */
apiRouter.get('/health', (_req, res) => {
  ok(res, { status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/home', homeRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/songs', songsRouter);
apiRouter.use('/albums', albumsRouter);
apiRouter.use('/playlists', playlistsRouter);
apiRouter.use('/artists', artistsRouter);
apiRouter.use('/lyrics', lyricsRouter);
