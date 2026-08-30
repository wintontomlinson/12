import type { ApiResponse } from '@shared/types';

/**
 * Typed fetch wrapper.
 *
 * Unwraps the `{ success, data | error }` envelope in one place so callers get
 * either data or a thrown `ApiRequestError` — no per-call-site envelope checks.
 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Relative path: Vite proxies /api in dev, Vercel rewrites it in production.
  const response = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json' },
    ...init,
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      'The server returned an unreadable response.',
      'MALFORMED_RESPONSE',
      response.status,
    );
  }

  if (!payload.success) {
    throw new ApiRequestError(payload.error.message, payload.error.code, response.status);
  }
  return payload.data;
}
