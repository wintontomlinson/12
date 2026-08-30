import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiFailure } from '../../../shared/types.js';
import { ApiError } from '../lib/errors.js';
import { isProduction } from '../config/env.js';

/** Terminal 404 for unmatched API paths, keeping the error envelope uniform. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiFailure = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      // `originalUrl`, not `path`: this handler is mounted at `/api`, so
      // `req.path` would have the prefix stripped and report `/nope` for a
      // request to `/api/nope`.
      message: `No API route matches ${req.method} ${req.originalUrl}`,
    },
  };
  res.status(404).json(body);
};

/**
 * Single exit point for every failure.
 *
 * Known `ApiError`s surface their status and code. Anything else is an
 * unexpected bug, so it becomes a generic 500 — the real message is logged
 * server-side but withheld from the response in production, since stack traces
 * and upstream URLs should not leak to clients.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // Headers already flushed — Express must close the stream itself.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    const body: ApiFailure = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    res.status(error.status).json(body);
    return;
  }

  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  console.error('[sur] unhandled error:', error);

  /**
   * `detail` is returned even in production.
   *
   * A bare "An unexpected error occurred" left a live 500 impossible to diagnose
   * without platform log access, which turned a one-line bug into several rounds
   * of guesswork. There are no secrets to leak here: the upstream API is public
   * and unauthenticated. Stack traces are still withheld.
   */
  const body: ApiFailure = {
    success: false,
    error: {
      code: 'INTERNAL',
      message: isProduction ? 'An unexpected error occurred' : detail,
      detail,
    },
  };
  res.status(500).json(body);
};
