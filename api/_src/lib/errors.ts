import type { ApiErrorCode } from '../../../shared/types.js';

/**
 * The only error type routes should throw. Carries both the HTTP status and a
 * stable machine-readable code, so the frontend can branch on `code` without
 * parsing prose.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  /** Upstream reachable but refused or errored. */
  static upstream(message: string): ApiError {
    return new ApiError(502, 'UPSTREAM_FAILURE', message);
  }

  /** Upstream did not answer inside the configured budget. */
  static timeout(message: string): ApiError {
    return new ApiError(504, 'UPSTREAM_TIMEOUT', message);
  }

  /** Upstream answered with something we cannot interpret. */
  static malformed(message: string): ApiError {
    return new ApiError(502, 'UPSTREAM_MALFORMED', message);
  }

  static internal(message: string): ApiError {
    return new ApiError(500, 'INTERNAL', message);
  }
}
