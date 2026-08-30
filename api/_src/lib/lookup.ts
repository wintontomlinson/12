import { ApiError } from './errors.js';
import { call, type UpstreamParams } from './saavnClient.js';

/**
 * Fetches a single resource by id, translating "upstream rejected this id" into
 * a 404.
 *
 * Verified behaviour: `song.getDetails` with an unknown id returns a failure
 * envelope, which the client surfaces as `UPSTREAM_FAILURE` (502). For a
 * resource-by-id route that is misleading — the correct answer is 404.
 *
 * Only `UPSTREAM_FAILURE` is remapped. Timeouts and malformed bodies pass
 * through untouched, so a genuine outage still reports as a 5xx instead of
 * masquerading as a missing record.
 */
export async function lookupById<T>(
  callName: string,
  params: UpstreamParams,
  notFoundMessage: string,
): Promise<T> {
  try {
    return await call<T>(callName, params);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UPSTREAM_FAILURE') {
      throw ApiError.notFound(notFoundMessage);
    }
    throw error;
  }
}
