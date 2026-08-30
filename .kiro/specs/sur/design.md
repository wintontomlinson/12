# Sur — Design

## 1. Repository layout

Single npm package, deployed as one Vercel project serving a static SPA plus one serverless function.

```
sur/
├─ api/
│  ├─ index.ts               # Vercel entry — `export default app`, no listen()
│  └─ _src/                  # `_` prefix: Vercel ignores these as routes
│     ├─ app.ts              # createApp(): express app assembly
│     ├─ config/env.ts
│     ├─ lib/
│     │  ├─ saavnClient.ts   # single outbound gateway to api.php
│     │  ├─ des.ts           # pure-JS DES-ECB decryption
│     │  ├─ text.ts          # HTML entity decode, artwork upgrade
│     │  └─ errors.ts        # ApiError + error envelope
│     ├─ normalizers/        # raw upstream → shared types
│     ├─ routes/
│     └─ middleware/
├─ server.ts                 # local dev only: app.listen()
├─ shared/types.ts           # single source of truth, imported by api + src
├─ src/                      # React app
├─ public/
└─ vercel.json
```

`shared/` is imported by both sides, so the API response type and the React prop type are literally the same declaration. A backend field rename becomes a frontend compile error.

## 2. Request flow

```
Browser ──▶ /api/home ──▶ api/index.ts ──▶ Express router
                                              │
                                     saavnClient.call()
                                              │
                                    jiosaavn.com/api.php
                                              │
                                    normalizers (+ DES decrypt)
                                              ▼
                                    stable camelCase JSON
Browser ──────────────────────────────────────┘
   │
   └──▶ audio bytes fetched DIRECTLY from *.saavncdn.com (never proxied)
```

Keeping audio off the backend path is the single most important architectural decision: it preserves range requests for seeking, avoids serverless response-size and duration limits, and keeps the function's job to sub-second JSON transforms.

## 3. Backend

### 3.1 Upstream gateway — `saavnClient.ts`

One function owns every outbound call:

```ts
call<T>(callName: string, params: Record<string, string | number>): Promise<T>
```

Responsibilities:
- Injects the constant params (`_format=json`, `_marker=0`, `ctx=web6dot0`, `api_version=4`) so no route can forget them.
- Sends a browser-like `User-Agent`; the upstream is inconsistent without one.
- Bounds every request with an `AbortController` timeout (default 10 s) — required by N5.2, since a hung upstream would otherwise pin the function until Vercel kills it.
- Detects the upstream's soft failures. JioSaavn returns HTTP 200 with `{"status":"failure","error":{...}}`, so status code alone is not a success signal; the client inspects the body and raises `ApiError`.

Centralising this means retry/timeout/UA policy changes happen in one place.

### 3.2 DES decryption — `des.ts`

Audio URLs arrive as base64 DES-ECB ciphertext under a fixed key.

**Constraint driving the design:** Node 22 ships OpenSSL 3, which classifies DES as legacy and rejects `crypto.createDecipheriv('des-ecb', …)` with `ERR_OSSL_EVP_UNSUPPORTED`. The `--openssl-legacy-provider` flag resolves it locally but cannot be relied on inside Vercel's managed runtime. So we use a pure-JS DES, verified to produce output identical to OpenSSL for the same input.

```
base64 decode → DES-ECB decrypt (key "38346591", padding disabled)
              → strip PKCS5 padding manually
              → utf8 URL ending in _96.mp4
```

Padding is disabled in the cipher and stripped by hand because the library's own padding handling drops the final block. The last byte gives the pad length; it is only trusted when in range 1–8 and consistent, otherwise the buffer is returned intact.

Quality selection is then a filename substitution (`_96` → `_320`), yielding a `downloadUrl` array of `{ quality, url }` so the client can choose. Every entry is generated from the one decrypted URL; no extra upstream calls.

Failures here are contained: a track whose URL will not decrypt gets `downloadUrl: []` rather than failing the whole album response.

### 3.3 Normalization

Raw payloads are hostile to UI code: snake_case, numbers-as-strings, `"true"`-as-string, HTML entities, 150 px artwork, and inconsistent nesting between endpoints. Normalizers convert once at the boundary.

Per entity: `normalizeSong`, `normalizeAlbum`, `normalizePlaylist`, `normalizeArtist`.

Because carousels return **mixed** types (verified: a `song` inside `new_albums`), there is also a polymorphic `normalizeEntity` that dispatches on the item's own `type` field and returns a discriminated union. A card renders from `entity.type`, so the API's shifting content cannot produce a mis-routed link.

Shared transforms in `text.ts`:
- `decodeEntities` — `&quot;` → `"` etc.
- `upgradeImage` — `150x150` → `500x500`, tolerating URLs without the token.
- `toImageSet` — normalizes the image field, which is sometimes a string and sometimes an array of quality variants.

### 3.4 Routes

| Method & path | Upstream `__call` | Notes |
| --- | --- | --- |
| `GET /api/health` | — | Liveness, no upstream dependency |
| `GET /api/home` | `webapi.getLaunchData` | Maps the four keys to labelled sections |
| `GET /api/search/suggest?q=` | `autocomplete.get` | Grouped live suggestions for the navbar |
| `GET /api/search?q=&type=&page=` | `search.getResults` / `search.getAlbumResults` / `search.getArtistResults` / `search.getPlaylistResults` | `type=all` fans out concurrently |
| `GET /api/songs/:id` | `song.getDetails` | Includes decrypted `downloadUrl` |
| `GET /api/albums/:id` | `content.getAlbumDetails` | Header + tracklist |
| `GET /api/playlists/:id` | `playlist.getDetails` | Header + tracklist |
| `GET /api/artists/:id` | `artist.getArtistPageDetails` | Top songs, albums, singles, bio |
| `GET /api/lyrics/:songId` | `lyrics.getLyrics` | Song id as `lyrics_id`; missing lyrics → `200 { lyrics: null }` |

Lyrics deliberately return 200 with a null body rather than 404: absent lyrics are the normal case for roughly half of tracks and must not look like a client error to the frontend's error handling.

`/api/home` resolves its sections with `Promise.allSettled` semantics per section so a single malformed key degrades one carousel (R8.3) instead of the page.

### 3.5 Errors

`ApiError` carries an HTTP status, a stable machine-readable `code`, and a human message. A terminal middleware renders every failure as:

```json
{ "success": false, "error": { "code": "UPSTREAM_FAILURE", "message": "…" } }
```

Successes are wrapped as `{ "success": true, "data": … }`. A uniform envelope lets the frontend's fetch wrapper decide error-vs-success in one place instead of per call site.

### 3.6 Dual entry points

`api/index.ts` exports the configured app — Vercel wraps it as a function handler. `server.ts` imports the same factory and calls `listen()`. The listener exists in a file the production build never imports, satisfying N1.2 structurally rather than by convention.

## 4. Frontend

### 4.1 State — Zustand

Three stores, split by change frequency to control re-render scope:

**`usePlayerStore`** — the machine: `currentTrack`, `queue`, `queueIndex`, `originalQueue` (shuffle restore), `isPlaying`, `volume`, `isMuted`, `shuffle`, `repeat`, `position`, `duration`, `status`.

`position` updates several times per second. It lives in the store but every consumer subscribes with a selector, so the seek bar re-renders while artwork and controls do not.

`originalQueue` is retained so toggling shuffle off restores the true order rather than leaving a permanently scrambled queue (R3.3).

**`useLibraryStore`** — `likedSongs`, `recentlyPlayed`, persisted to `localStorage` via Zustand `persist`.

**`useUiStore`** — panel visibility (lyrics, queue, sidebar, fullscreen). Ephemeral, unpersisted.

Persistence is partialized: `isPlaying` and transient `status` are never written, so a refresh cannot restore a "playing" state the browser will refuse to honour (R6.2). A `version` field lets a schema change invalidate old state instead of hydrating a mismatched shape (R6.3).

### 4.2 Audio — Howler + AnalyserNode

The two audio requirements pull in opposite directions and the resolution is the crux of `usePlayer`:

- Streaming and seeking need Howler's `html5: true` (HTML5 Audio element, range requests, instant start).
- The equalizer needs a Web Audio `AnalyserNode`. Howler's Web Audio path (`html5: false`) exposes `Howler.masterGain`, but that mode buffers the entire file before playing — unacceptable for streaming.

Resolution: run Howler in `html5: true` mode and bridge the underlying `<audio>` element into the Web Audio graph with `createMediaElementSource`:

```
<audio> ──▶ MediaElementAudioSourceNode ──▶ AnalyserNode ──▶ destination
```

Details that make this work:
- The element needs `crossOrigin = 'anonymous'`. The CDN's `Access-Control-Allow-Origin: *` (verified) means the graph is not tainted; without CORS the analyser would only ever read zeros.
- `createMediaElementSource` throws if called twice on the same element, and Howler pools/reuses elements — so wrapped elements are tracked in a `WeakMap` and reused.
- Once an element is routed through Web Audio it no longer reaches the speakers implicitly; the chain **must** terminate at `destination`.
- The `AudioContext` starts suspended until a user gesture, so it is resumed on the first play.
- Every step is wrapped so that failure disables the visualiser but leaves playback working (R9.3).

Position updates come from a `requestAnimationFrame` loop that runs only while playing, rather than a always-on interval.

Seeking uses a local "dragging" flag: while the user drags, the rAF loop stops writing position, preventing the thumb from being yanked backwards by a stale value mid-gesture (R3.6).

### 4.3 Data fetching

A thin typed `apiFetch` unwraps the response envelope and throws on `success: false`, plus small `useQuery`-style hooks exposing `{ data, error, isLoading, retry }` — the exact shape the skeleton and error components consume, so every async region handles all three states uniformly.

Search debouncing discards superseded responses by comparing a request sequence number on resolution (R2.3).

### 4.4 Routing

React Router: `/`, `/search`, `/album/:id`, `/playlist/:id`, `/artist/:id`, `/liked`. The player bar and stores live above the router outlet so navigation never unmounts the audio element — a remount would restart playback.

## 5. Key risks

| Risk | Mitigation |
| --- | --- |
| DES unavailable in serverless runtime | Pure-JS implementation, verified against OpenSSL output |
| Audio proxying would break seeking | Direct CDN playback; backend is metadata-only |
| Mixed entity types in carousels | Polymorphic normalizer dispatching on `type` |
| Double `createMediaElementSource` throw | `WeakMap` of wrapped elements |
| Restored "playing" state blocked by autoplay policy | Persist paused; require a gesture |
| Upstream 200-with-failure-body | Client inspects body, not just status |
| Hung upstream consuming function time | `AbortController` timeout on every call |
| Missing lyrics treated as an error | 200 + `lyrics: null`, neutral empty state |
