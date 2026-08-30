import type { Response } from 'express';
import type { ApiSuccess } from '../../../shared/types.js';

/**
 * Wraps a payload in the success envelope.
 *
 * Every route returns through here so the frontend's fetch wrapper can decide
 * success-vs-failure in exactly one place instead of per call site.
 */
export function ok<T>(res: Response, data: T, cacheSeconds = 0): Response {
  if (cacheSeconds > 0) {
    /**
     * CDN-level caching only (`s-maxage`) — the app itself stays stateless per
     * requirement N1.3. `stale-while-revalidate` lets Vercel's edge serve a
     * slightly old response instantly while refreshing behind it, which also
     * blunts cold-start latency on the homepage.
     */
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    );
  }

  const body: ApiSuccess<T> = { success: true, data };
  return res.status(200).json(body);
}
