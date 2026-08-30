import { createApp } from './_src/app.js';

/**
 * Vercel serverless entry point.
 *
 * `@vercel/node` accepts an Express app as the default export and adapts it to
 * the platform's request handler. There is intentionally no `listen()` call
 * here — see `server.ts` for the local development listener.
 *
 * Sibling backend source lives under `_src/`; Vercel skips `_`-prefixed paths
 * when discovering functions, so this file is the only function in the
 * deployment.
 */
const app = createApp();

export default app;
