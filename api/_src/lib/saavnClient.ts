import { env } from '../config/env.js';
import { ApiError } from './errors.js';
import { asRecord } from './text.js';

/**
 * The single outbound gateway to JioSaavn.
 *
 * Every upstream call funnels through `call()` so that timeout, User-Agent and
 * failure-detection policy live in exactly one place. No route builds its own
 * request.
 */

/** Params required on every request. Centralised so a route cannot omit one. */
const CONSTANT_PARAMS: Record<string, string> = {
  _format: 'json',
  _marker: '0',
  ctx: 'web6dot0',
  api_version: '4',
};

/**
 * The upstream is inconsistent — and sometimes outright refuses — without a
 * browser-like User-Agent.
 */
const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export type UpstreamParams = Record<string, string | number | boolean | undefined>;

function buildUrl(callName: string, params: UpstreamParams): string {
  const url = new URL(env.saavnApiBase);
  url.searchParams.set('__call', callName);

  for (const [key, value] of Object.entries(CONSTANT_PARAMS)) {
    url.searchParams.set(key, value);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Detects upstream soft failures.
 *
 * JioSaavn signals errors with HTTP **200** and a body of
 * `{"status":"failure","error":{...}}`, so the status code alone is not a
 * success signal. Verified directly: requesting lyrics for a track without
 * lyrics returns 200 with a failure body.
 */
function extractUpstreamFailure(payload: unknown): string | null {
  const record = asRecord(payload);
  if (record['status'] !== 'failure') return null;

  const error = asRecord(record['error']);
  const message = error['msg'] ?? error['message'] ?? record['message'];
  return typeof message === 'string' && message.length > 0 ? message : 'Upstream reported a failure';
}

/**
 * Calls a JioSaavn `__call` endpoint and returns the parsed body.
 *
 * @throws ApiError — timeout (504), transport/HTTP failure (502), unparseable
 *   body (502), or an upstream failure envelope (502).
 */
export async function call<T>(callName: string, params: UpstreamParams = {}): Promise<T> {
  /**
   * Guarded: `new URL()` inside `buildUrl` throws synchronously on a malformed
   * base, and being outside a try/catch made that surface as an opaque
   * `500 INTERNAL` rather than a diagnosable error.
   */
  let url: string;
  try {
    url = buildUrl(callName, params);
  } catch (cause) {
    throw ApiError.internal(
      `Could not build the upstream URL for "${callName}" from base ` +
        `"${env.saavnApiBase}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  // Bounds the request so a hung upstream cannot occupy the serverless
  // function until the platform kills it (requirement N5.2).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.upstreamTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw ApiError.timeout(`Upstream call "${callName}" exceeded ${env.upstreamTimeoutMs}ms`);
    }
    const detail = cause instanceof Error ? cause.message : 'unknown transport error';
    throw ApiError.upstream(`Upstream call "${callName}" failed: ${detail}`);
  }

  if (!response.ok) {
    clearTimeout(timer);
    throw ApiError.upstream(`Upstream call "${callName}" returned HTTP ${response.status}`);
  }

  /**
   * Read as text first: the upstream occasionally answers with an HTML error
   * page under a JSON content-type, and `response.json()` would throw a
   * context-free SyntaxError.
   *
   * Guarded and with the timer still armed, because `fetch` resolves as soon as
   * the HEADERS arrive — the body is still streaming. An abort or a socket reset
   * during that read throws here, outside the fetch's own catch, which would
   * otherwise escape as a raw `500 INTERNAL`.
   */
  let raw: string;
  try {
    raw = await response.text();
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw ApiError.timeout(
        `Upstream call "${callName}" exceeded ${env.upstreamTimeoutMs}ms while reading the response body`,
      );
    }
    throw ApiError.upstream(
      `Upstream call "${callName}" failed while reading the response body: ` +
        `${cause instanceof Error ? cause.message : 'unknown error'}`,
    );
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw ApiError.malformed(`Upstream call "${callName}" returned a non-JSON body`);
  }

  const failure = extractUpstreamFailure(payload);
  if (failure !== null) {
    throw ApiError.upstream(`Upstream call "${callName}" failed: ${failure}`);
  }

  return payload as T;
}

/**
 * Like `call`, but converts any failure into null.
 *
 * Used where absence is a legitimate outcome rather than an error — notably
 * lyrics (missing for roughly half of all tracks) and individual homepage
 * sections, which must degrade one carousel instead of the whole page.
 */
export async function callOptional<T>(
  callName: string,
  params: UpstreamParams = {},
): Promise<T | null> {
  try {
    return await call<T>(callName, params);
  } catch {
    return null;
  }
}
