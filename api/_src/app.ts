import express, { type Express, type RequestHandler } from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

/**
 * Minimal CORS, hand-rolled rather than pulling in the `cors` package.
 *
 * Only needed for local development, where Vite (5173) and Express (3001) are
 * separate origins. In production both sit behind Vercel's rewrites on one
 * origin, so this is effectively inert there. The API is read-only and
 * unauthenticated, so there are no credentials to protect.
 */
const cors: RequestHandler = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', env.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
};

/**
 * Builds the Express app.
 *
 * Deliberately does NOT call `listen()` — that would break serverless
 * invocation. The local dev listener lives in `server.ts`, a file the
 * production bundle never imports (requirement N1.2).
 */
export function createApp(): Express {
  const app = express();

  // Vercel terminates TLS upstream; without this, `req.protocol` and client IP
  // are read from the proxy hop rather than the original request.
  app.set('trust proxy', true);

  // No `X-Powered-By: Express` advertisement.
  app.disable('x-powered-by');

  app.use(cors);

  /**
   * Mounted at `/api` because Vercel preserves the full path when rewriting
   * `/api/*` to this function. Local dev goes through Vite's proxy, which also
   * preserves it — so one mount point serves both environments identically.
   */
  app.use('/api', apiRouter);

  // Unmatched API paths get the same JSON envelope as any other failure.
  app.use('/api', notFoundHandler);

  // Terminal error middleware — must be registered last.
  app.use(errorHandler);

  return app;
}
