import { createApp } from './api/_src/app.js';
import { env } from './api/_src/config/env.js';

/**
 * LOCAL DEVELOPMENT ONLY.
 *
 * This is the only place `listen()` is called. Vercel imports `api/index.ts`
 * instead, which exports the app without binding a port — calling `listen()` in
 * a serverless function would hold the invocation open and eventually time out.
 *
 * Run via `npm run dev` (alongside Vite) or `npm run dev:api` on its own.
 */
const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[sur] API listening on http://localhost:${env.port}`);
  console.log(`[sur] health check:      http://localhost:${env.port}/api/health`);
});

// Without this, `tsx watch` restarts leave the port bound and the next boot
// dies with EADDRINUSE.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[sur] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
