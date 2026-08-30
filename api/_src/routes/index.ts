import { Router } from 'express';
import { env } from '../config/env.js';
import { ok } from '../lib/respond.js';
import { call } from '../lib/saavnClient.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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

/**
 * Liveness probe with no upstream dependency — distinguishes "our function is
 * broken" from "JioSaavn is down" when debugging a deployment.
 *
 * Also reports the runtime facts that actually matter when a deployment behaves
 * differently from local: the Node version, the region, whether `fetch` exists,
 * and which upstream host is configured. Diagnosing a live 500 without these
 * meant guessing.
 *
 * `?probe=1` additionally makes one real upstream request and reports its status
 * and latency, which separates "we cannot reach JioSaavn" from "our code threw".
 */
apiRouter.get(
  '/health',
  asyncHandler(async (req, res) => {
    const runtime = {
      node: process.version,
      region: process.env.VERCEL_REGION ?? null,
      env: env.nodeEnv,
      hasFetch: typeof fetch === 'function',
      upstreamHost: safeHost(env.saavnApiBase),
      upstreamTimeoutMs: env.upstreamTimeoutMs,
    };

    if (req.query['probe'] !== '1') {
      ok(res, { status: 'ok', timestamp: new Date().toISOString(), runtime });
      return;
    }

    const startedAt = Date.now();
    let probe: { reachable: boolean; detail: string };
    try {
      await call<unknown>('webapi.getLaunchData');
      probe = { reachable: true, detail: 'ok' };
    } catch (cause) {
      probe = {
        reachable: false,
        detail: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      };
    }

    ok(res, {
      status: probe.reachable ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime,
      upstream: { ...probe, latencyMs: Date.now() - startedAt },
    });
  }),
);

/** Host only — never echo a full configured URL back to a client. */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid';
  }
}

apiRouter.use('/home', homeRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/songs', songsRouter);
apiRouter.use('/albums', albumsRouter);
apiRouter.use('/playlists', playlistsRouter);
apiRouter.use('/artists', artistsRouter);
apiRouter.use('/lyrics', lyricsRouter);
