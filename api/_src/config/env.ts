/**
 * Runtime configuration. Every value has a working default because the
 * upstream API is unauthenticated — the app must boot with an empty
 * environment (requirement N6.2).
 */

const DEFAULT_SAAVN_API_BASE = 'https://www.jiosaavn.com/api.php';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Returns `value` only if it parses as an absolute http(s) URL.
 *
 * Trailing whitespace and a missing scheme are the usual ways a dashboard-entered
 * value goes wrong, and both make `new URL()` throw.
 */
function validUrlOr(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`unsupported protocol "${parsed.protocol}"`);
    }
    return parsed.toString();
  } catch (cause) {
    console.error(
      `[sur] SAAVN_API_BASE is not a valid absolute URL (${JSON.stringify(candidate)}): ` +
        `${cause instanceof Error ? cause.message : String(cause)}. Falling back to the default.`,
    );
    return fallback;
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** Local dev listener port. Unused in serverless, where Vercel invokes the app directly. */
  port: num(process.env.API_PORT, 3001),

  /**
   * Upstream base. Overridable so a mock can be substituted in tests.
   *
   * VALIDATED, because an unparseable value used to take the whole API down in a
   * confusing way: `new URL(base)` throws synchronously inside the request path,
   * producing an opaque `500 INTERNAL` on every upstream route while
   * `/api/health` kept returning 200. A bad override now logs loudly and falls
   * back to the default instead of breaking every request.
   */
  saavnApiBase: validUrlOr(process.env.SAAVN_API_BASE, DEFAULT_SAAVN_API_BASE),

  /**
   * Hard ceiling on any single upstream call.
   *
   * Deliberately below Vercel's DEFAULT function timeout of 10s, so a slow
   * upstream produces a clean 504 from us rather than the platform killing the
   * invocation mid-response (requirement N5.2). `vercel.json` no longer pins
   * `maxDuration`, so 10s is the figure to stay under.
   */
  upstreamTimeoutMs: num(process.env.UPSTREAM_TIMEOUT_MS, 8_000),

  /**
   * CORS allowlist for local dev, where Vite (5173) and Express (3001) are
   * different origins. In production both are the same origin behind Vercel's
   * rewrites, so this is effectively inert.
   */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
} as const;

export const isProduction = env.nodeEnv === 'production';
