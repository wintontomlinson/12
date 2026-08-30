# Deploying Sur

## 1. Run it locally first

```bash
npm install
npm run dev
```

| What | Where |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |

Vite proxies `/api` to the Express dev server, so the frontend uses relative
`/api/...` paths in both development and production — there is no environment
switch to get wrong.

**No `.env` file is required.** The JioSaavn API is unauthenticated and every
setting has a working default. Copy `.env.example` to `.env` only to override one.

Before deploying, confirm the production build works:

```bash
npm run build      # tsc -b (all three projects) then vite build -> dist/
```

## 2. Vercel setup

Import the repository at [vercel.com/new](https://vercel.com/new).

| Setting | Value |
| --- | --- |
| Framework Preset | **Other** (`vercel.json` sets `framework: null`) |
| Root Directory | **empty** (repository root) |
| Build Command | leave default — `vercel.json` sets `npm run build` |
| Output Directory | leave default — `vercel.json` sets `dist` |
| Install Command | leave default — `vercel.json` sets `npm ci` |
| Environment Variables | **none** |
| Node version | 20 or later (`package.json` declares `>=20`) |

Everything routing-related is committed, so the dashboard should need no changes:

```json
{
  "framework": null,
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The second rewrite is what makes a hard refresh on `/album/123` work instead of
404ing. Rewrites are evaluated top-down and the first match wins, so `/api/*` is
claimed before the SPA catch-all. Real files in `dist/` are served before
rewrites are consulted, so hashed assets are unaffected.

### Why `installCommand` is pinned

The repository still contains a legacy Flask proxy (`app.py`, `helpers.py`,
`models.py`, `requirements.txt`). With `requirements.txt` at the root, Vercel's
detector can reasonably conclude this is a Python project and attempt a pip
install — and `cryptography` needs a Rust toolchain, which is a plausible build
failure. Pinning `npm ci` makes the install unambiguously Node.

Those files are unused and can be deleted, or moved to `legacy/`, at any time.

## 3. Verify after deploying

```bash
curl -s https://<your-deployment>/api/health
# -> {"success":true,"data":{"status":"ok","timestamp":"..."}}

curl -s https://<your-deployment>/api/home | head -c 200
# -> {"success":true,"data":{"sections":[...
```

Then in a browser:

1. Home shows four carousels with artwork.
2. Clicking a card starts audio.
3. The seek bar can be dragged to a new position.
4. Open `/album/<some-id>` and **hard refresh** — it should load, not 404.
5. Type in the search box; suggestions appear as you pause typing.
6. Open the lyrics panel on a well-known track.
7. Refresh mid-track: the player restores **paused** at the saved position.

## 4. Known limitations

### Cold starts
The API is a single serverless function. The first request after an idle period
pays initialization cost, typically a second or two. `/api/home` sets
`s-maxage=300, stale-while-revalidate=600`, so the most-visited route is usually
served from the edge cache and hides this.

### Function timeout
`maxDuration` is not pinned, so Vercel's default (10s) applies. The upstream
budget is 8s, meaning a slow JioSaavn response returns our own
`504 UPSTREAM_TIMEOUT` rather than being killed mid-response by the platform.
Raise both together if you ever need to.

### The upstream API is undocumented and unstable
JioSaavn's endpoints are unofficial. They can change shape or disappear without
notice. Mitigations already in place:

- Failures are detected from the response **body**, because the upstream returns
  errors with HTTP 200.
- `/api/home` degrades one carousel rather than the whole page.
- `/api/search?type=all` tolerates individual categories failing.
- Unknown ids are treated as 404s rather than 502s.

If the catalogue starts returning odd data, check `/api/health` first: it has no
upstream dependency, so a healthy `/api/health` alongside failing routes points
at JioSaavn, not the deployment.

### Audio is not proxied
Audio streams directly from `*.saavncdn.com` to the browser. This is deliberate —
it preserves range requests (seeking) and keeps serverless response limits out of
the playback path. It also means playback depends on that CDN remaining
publicly reachable and CORS-enabled from your users' networks.

### No accounts
Likes, recently played and player state live in `localStorage`. They are
per-browser and do not sync across devices. Clearing site data resets them.

### Lyrics coverage is partial
Roughly half of tracks have no lyrics, which renders as a neutral "No lyrics
available" message. Note the upstream `has_lyrics` flag is unreliable — it
reports `false` for tracks that do have lyrics — so the app always attempts the
fetch and lets the response decide.

### Browser autoplay policy
A restored session always starts **paused**. Browsers refuse to play audio
without a user gesture, so resuming automatically would produce a UI that claims
to be playing while silent.

## 5. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `No Output Directory named "dist"` | Root Directory is set in the dashboard; clear it so it points at the repo root |
| Build log mentions `pip` / `cryptography` | Python was detected. `installCommand` should prevent it; otherwise delete the legacy Flask files |
| `maxDuration must be between...` | A `functions` block was reintroduced with a value above your plan's limit |
| Deep links 404 on refresh | The SPA rewrite is missing or ordered before `/api/*` |
| API works, no audio | Check the browser console for a CORS or mixed-content error on `*.saavncdn.com` |
| Everything 502s | Upstream outage — confirm `/api/health` still returns 200 |
