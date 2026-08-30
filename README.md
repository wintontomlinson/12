# Sur

A Spotify-style music streaming web player. React + TypeScript frontend, Express + TypeScript API, JioSaavn as the data source, built for Vercel.

## Architecture at a glance

```
Browser ──▶ /api/*  ──▶ Express (single Vercel function) ──▶ jiosaavn.com/api.php
   │                         └─ normalizes + decrypts audio URLs
   └──▶ audio bytes fetched DIRECTLY from *.saavncdn.com
```

The backend serves **metadata only**. Audio streams straight from the JioSaavn CDN to the browser, which preserves HTTP range requests (so seeking works) and keeps serverless response-size and duration limits out of the playback path entirely.

## Project layout

```
api/
  index.ts              Vercel entry — exports the app, never calls listen()
  _src/                 backend source ("_" keeps Vercel from treating these as functions)
    app.ts              createApp(): middleware + route assembly
    config/env.ts       configuration with working defaults
    lib/
      saavnClient.ts    the only outbound gateway to JioSaavn
      des.ts            pure-JS DES audio URL decryption
      lookup.ts         by-id fetch that maps upstream rejection to 404
      text.ts           entity decoding, artwork upgrade, type coercion
      errors.ts         ApiError
      respond.ts        success envelope
    normalizers/        raw upstream payloads → shared types
    routes/             home, search, songs, albums, playlists, artists, lyrics
    middleware/         asyncHandler, errorHandler
server.ts               LOCAL DEV ONLY — the sole app.listen() call
shared/types.ts         types imported by BOTH api/ and src/
src/                    React frontend
vercel.json             rewrites: /api/* → function, everything else → index.html
```

`shared/types.ts` is imported by both sides, so an API field rename becomes a frontend compile error instead of a runtime `undefined`.

## Running locally

```bash
npm install
cp .env.example .env      # optional — every value has a working default
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001 (Vite proxies `/api` to it, so the frontend uses relative `/api/...` paths in both dev and production)
- Health check: http://localhost:3001/api/health

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend + API together |
| `npm run dev:api` | API only, with watch |
| `npm run dev:web` | Frontend only |
| `npm run build` | Typecheck all projects, then build the frontend to `dist/` |
| `npm run typecheck` | Types only, no emit |

## Configuration

No secrets are required — the upstream API is unauthenticated and the app boots with an empty environment. See [`.env.example`](./.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PORT` | `3001` | Local dev API port. Ignored on Vercel |
| `SAAVN_API_BASE` | `https://www.jiosaavn.com/api.php` | Upstream endpoint; override to point at a mock |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Per-request upstream budget, kept below the function `maxDuration` |
| `CORS_ORIGIN` | `*` | Only relevant in dev, where Vite and Express are separate origins |

## API

All responses use one envelope, so the client decides success in a single place:

```jsonc
{ "success": true,  "data": { … } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "…" } }
```

Error codes: `BAD_REQUEST`, `NOT_FOUND`, `UPSTREAM_FAILURE`, `UPSTREAM_TIMEOUT`, `UPSTREAM_MALFORMED`, `INTERNAL`.

| Route | Description |
| --- | --- |
| `GET /api/health` | Liveness; no upstream dependency |
| `GET /api/home` | The four homepage carousels from one upstream call |
| `GET /api/search?q=&type=&page=&limit=` | `type`: `all` (default), `song`, `album`, `artist`, `playlist` |
| `GET /api/search/suggest?q=&limit=` | Compact grouped payload for live navbar suggestions |
| `GET /api/songs/:id` | Song detail with decrypted playback URLs. `:id` accepts a comma-separated list |
| `GET /api/albums/:id` | Album header + full tracklist |
| `GET /api/playlists/:id?limit=` | Playlist header + tracklist |
| `GET /api/artists/:id` | Bio, top songs, top albums, singles, similar artists |
| `GET /api/lyrics/:songId` | Plain-text lyrics; `lyrics: null` when none exist |

## Notes on the upstream API

Behaviours verified against the live API, each of which shaped the implementation:

**DES cannot use `node:crypto`.** Audio URLs are base64 DES-ECB ciphertext under the fixed key `38346591`. Node 22 ships OpenSSL 3, which treats DES as legacy and rejects `createDecipheriv('des-ecb', …)` with `ERR_OSSL_EVP_UNSUPPORTED`. The `--openssl-legacy-provider` flag fixes it locally but is not dependable inside Vercel's runtime, so `lib/des.ts` uses a pure-JS DES verified to produce byte-identical output. Padding is stripped manually because the library's own padding handling drops the final block — which silently truncated the `.mp4` extension.

**Carousels are heterogeneous.** A single section mixes entity types: `new_trending` was observed returning 17 albums, 3 songs and 4 playlists together. Normalization dispatches on each item's own `type`, so cards cannot mis-route.

**`has_lyrics` is unreliable.** For `aRZbUYD7` ("Tum Hi Ho"), `song.getDetails` reports `false` while `playlist.getDetails` reports `true` and lyrics genuinely exist. The flag is a display hint only; the lyrics route always attempts the fetch. Also note `more_info.lyrics_id` does not exist — the **song id** is the lyrics key.

**Errors arrive with HTTP 200.** Failures come back as `{"status":"failure", …}` with a 200 status, so the client inspects the body rather than trusting the status code.

**Unknown ids return populated-looking shells.** An unknown `artistId` is echoed back with an empty `name`, a placeholder image and empty collections at HTTP 200. Detail routes therefore validate a meaningful field (name/title) rather than the id.

**Quality is a filename swap.** The decrypted URL ends `_96.mp4`; `_320` returns HTTP 206. All five bitrate variants are derived from one decryption with no extra upstream calls.

**Everything is stringly typed.** Durations, counts and booleans arrive as strings — including the string `"false"`, which is truthy in JavaScript. All coercion is centralised in `lib/text.ts`.

## License

Personal/educational project. JioSaavn content and trademarks belong to their respective owners; this project is unaffiliated.
