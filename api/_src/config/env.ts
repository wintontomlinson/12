/**
 * Runtime configuration. Every value has a working default because the
 * upstream API is unauthenticated — the app must boot with an empty
 * environment (requirement N6.2).
 */

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** Local dev listener port. Unused in serverless, where Vercel invokes the app directly. */
  port: num(process.env.API_PORT, 3001),

  /** Upstream base. Overridable so a mock can be substituted in tests. */
  saavnApiBase: process.env.SAAVN_API_BASE ?? 'https://www.jiosaavn.com/api.php',

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
