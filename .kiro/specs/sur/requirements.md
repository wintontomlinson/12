# Sur — Requirements

A Spotify-like music streaming web player backed by the JioSaavn public API, deployed on Vercel.

## 1. Scope

### In scope
Search, browse (homepage carousels), album/playlist/artist detail pages, full audio playback with queue, likes, persisted player state, static lyrics, skeleton loading, error UI.

### Out of scope
User accounts / server-side auth, social features, playlist creation on JioSaavn, podcasts & episodes, downloads/offline, video, karaoke-timed lyrics (the API returns no timing data), collaborative sessions, cross-device handoff.

## 2. Verified API contract

These were validated against the live API before writing this document. Implementation must not deviate without re-verification.

| Concern | Finding |
| --- | --- |
| Base endpoint | `https://www.jiosaavn.com/api.php` with `__call`, `_format=json`, `_marker=0`, `ctx=web6dot0`, `api_version=4` |
| Homepage | `webapi.getLaunchData` returns `new_trending`, `new_albums`, `charts`, `top_playlists` |
| Entity typing | Carousel items are **heterogeneous**; `new_albums` returned a `song` as its first item. Every item carries a `type` discriminator (`song`/`album`/`playlist`/`artist`) |
| Audio URL | `more_info.encrypted_media_url`, DES-ECB + PKCS5, key `38346591`, base64 input |
| Audio quality | Decrypted URL ends `_96.mp4`; substituting `_320` returns HTTP 206 — quality is a filename swap |
| Lyrics | `lyrics.getLyrics` keyed by **song id** (`lyrics_id` param name, song id value). `more_info.lyrics_id` is `null` and unusable |
| Lyrics format | `<br>`-delimited plain text with **no timestamps** → static panel only |
| Lyrics availability | Absence is normal (~19 of 47 songs in a sampled chart had the flag set), and is not an error |
| `has_lyrics` reliability | **Unreliable — a display hint only, never a gate.** For song `aRZbUYD7` ("Tum Hi Ho"), `song.getDetails` reports `"false"` while `playlist.getDetails` reports `"true"`, and `lyrics.getLyrics` returns real lyrics regardless. The lyrics route must always attempt the fetch |
| CDN CORS | `Access-Control-Allow-Origin: *` → Web Audio analysis of playing audio is possible |
| CDN range | `Accept-Ranges: bytes`, serves 206 → seeking works via direct CDN playback |
| Artwork | URLs contain `150x150`; substituting `500x500` returns HTTP 200 |
| Text encoding | Titles contain HTML entities (`&quot;`) that must be decoded |

## 3. Functional requirements

### R1 — Homepage browse
1. Display a time-aware greeting ("Good morning/afternoon/evening") derived from the client clock.
2. Render four horizontal carousels from one backend call: Trending Now (`new_trending`), New Releases (`new_albums`), Top Charts (`charts`), Made For You (`top_playlists`).
3. Render a "Recently played" row sourced from `localStorage`, hidden entirely when empty.
4. Each card exposes a play affordance on hover; cards navigate to their detail route on click.
5. Because carousel items are mixed types, each card must route by its own `type`, not by the carousel it sits in.
6. A carousel that returns zero items is omitted rather than rendered empty.

### R2 — Search
1. A persistent search field in the top navbar issues debounced queries (250–300 ms) as the user types.
2. Results are grouped into Songs, Albums, Artists, Playlists.
3. Queries superseded by newer input must not overwrite fresher results (out-of-order responses discarded).
4. Submitting navigates to `/search?q=…`; the query is reflected in the URL so results are shareable and survive refresh.
5. A query with no matches shows an explicit empty state, distinct from the error state.
6. Clicking a song result begins playback; other result types navigate to detail pages.

### R3 — Playback
1. Play, pause, next, previous, seek, and volume all function against real audio.
2. Previous restarts the current track when playback position exceeds ~3 s, otherwise steps to the prior track.
3. Shuffle reorders upcoming queue entries without losing the currently playing track.
4. Repeat cycles off → all → one; repeat-one replays the current track on completion.
5. Track completion advances to the next queue item; at the end of the queue with repeat off, playback stops.
6. Seeking is driven by a draggable progress bar with a green fill; dragging must not fight the playback-position updates.
7. Volume is adjustable and mutable, with the level persisted.
8. Requesting a track whose audio URL cannot be resolved surfaces an error and does not silently hang.

### R4 — Queue
1. Users can add a track to the end of the queue ("Add to Queue") or immediately after the current track ("Play Next").
2. A queue panel lists the current track and upcoming entries.
3. Playing an album or playlist replaces the queue with that collection's tracks starting at the chosen index.

### R5 — Likes
1. Liking or unliking a song is a single toggle available from the player bar and track rows.
2. Liked songs aggregate into an automatic "Liked Songs" collection reachable from the sidebar.
3. Likes persist across reloads via `localStorage`.

### R6 — Persistence
1. Current track, queue, position, volume, shuffle/repeat modes, likes, and recently-played survive a page refresh.
2. Playback is restored **paused** at the saved position; browsers forbid autoplay without a gesture.
3. Corrupt or schema-outdated persisted state is discarded in favour of defaults rather than crashing the app.

### R7 — Lyrics
1. A player-bar toggle opens a side panel showing plain-text lyrics for the current track.
2. `<br>` separators render as line breaks.
3. Tracks without lyrics show a neutral "No lyrics available" message, not an error.
4. The panel tracks track changes while open.
5. Lyrics are requested for any track the user opens the panel on. The `hasLyrics` flag must not suppress the request, because it is verifiably wrong for tracks that do have lyrics.

### R8 — Loading & error states
1. All async regions use skeleton shimmer placeholders shaped like their eventual content. No generic spinners.
2. Failed requests render an error state with a retry action.
3. A failure in one carousel must not blank the whole homepage.

### R9 — Equalizer visualisation
1. Animated bars are driven by a Web Audio `AnalyserNode` reading the actually-playing audio, not a canned animation.
2. Bars are idle/flat when playback is paused.
3. If the audio graph cannot be constructed, the app degrades to a static bar display and playback still works.

## 4. Layout requirements

### L1 — Left sidebar
Logo, Home / Search / Your Library navigation, playlist list, Liked Songs shortcut. Collapses to an off-canvas drawer on mobile.

### L2 — Top navbar
Back and forward history arrows, search input with live suggestions, profile icon.

### L3 — Main content
Greeting + recently played, the four carousels, and detail pages consisting of a banner header (large artwork, title, metadata, play button) over a tracklist table.

### L4 — Bottom player bar
- **Left** — artwork thumbnail, title/artist with marquee scroll when text overflows, like button.
- **Centre** — shuffle, previous, large circular play/pause, next, repeat; draggable seek bar with green fill and time labels.
- **Right** — lyrics toggle, queue toggle, volume slider, equalizer animation, fullscreen toggle.
- **Mobile** — condensed bar that expands to a fullscreen player via swipe-up.

## 5. Design requirements

| Token | Value |
| --- | --- |
| Background | `#121212` |
| Surface (cards, sidebar) | `#181818` |
| Accent | `#1DB954` |
| Text primary | `#FFFFFF` |
| Text secondary | `gray-400` |
| Font | Inter (Poppins fallback), bold headings |
| Card radius | 8–12 px |
| Card hover | `scale(1.03)` + shadow |
| Transitions | 200–300 ms |

## 6. Non-functional requirements

### N1 — Architecture
1. Backend is Express + TypeScript, written fresh for Node (not a line-by-line port of the reference Flask proxy).
2. Backend exports the app (`export default app`) for serverless invocation and never calls `listen()` in production. A separate `server.ts` provides the local dev listener.
3. Stateless only: no in-memory caches, no background workers, no WebSockets. Any instance can serve any request.
4. `vercel.json` rewrites `/api/*` to the backend function and everything else to `index.html` so client-side routes survive a refresh.

### N2 — Audio delivery
1. The backend serves metadata only. Audio bytes stream directly from the JioSaavn CDN to the browser, preserving range requests and keeping serverless response limits irrelevant.

### N3 — Cryptography portability
1. DES decryption must not depend on OpenSSL's legacy provider. Node 22 / OpenSSL 3 rejects `des-ecb` with `ERR_OSSL_EVP_UNSUPPORTED`, and the `--openssl-legacy-provider` flag is not dependable on Vercel. A pure-JavaScript DES implementation is required, verified to match OpenSSL output exactly.

### N4 — Boundary hygiene
1. No raw JioSaavn payload reaches React. All upstream responses pass through a normalization layer producing stable camelCase types with HTML entities decoded and artwork upgraded.
2. Frontend and backend share one set of TypeScript type definitions.

### N5 — Resilience
1. Upstream failures map to meaningful HTTP status codes with a consistent JSON error envelope.
2. Upstream calls are bounded by a timeout so a hung request cannot occupy a serverless function until platform timeout.
3. Homepage carousels resolve independently; one upstream failure degrades a single row.

### N6 — Configuration
1. Required environment variables are documented in `.env.example` and `README.md`.
2. The app runs with no secrets configured, since the upstream API is unauthenticated.

## 7. Acceptance criteria

The build is complete when:

1. `npm run dev` serves the frontend and API locally; `npm run build` produces a deployable artifact.
2. Every backend route returns normalized data from the live upstream API, verified by execution rather than inspection.
3. A song plays end-to-end from a decrypted CDN URL, seeks correctly, and advances to the next queue item.
4. Refreshing restores the player paused at its previous position with queue and likes intact.
5. Deep-linking to `/album/:id` and refreshing serves the app instead of a 404.
6. Equalizer bars respond to real audio amplitude.
7. Lyrics render for a track with lyrics and show the neutral empty state for one without.
8. A forced API failure produces a retry-able error UI, not a blank screen.
