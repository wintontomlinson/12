# Sur — Implementation Plan

Review checkpoints are part of the plan, not an afterthought. Stretch 1 runs uninterrupted; every later stage pauses for review.

## Stretch 1 — Foundation (no check-ins) ✅ DONE

- [x] **1.1 Specs** — requirements.md, design.md, tasks.md.
- [x] **1.2 Scaffold** — package.json, tsconfig (frontend/backend split), Vite, Tailwind theme tokens, directory skeleton, `public/`.
- [x] **1.3 Shared types** — `shared/types.ts`: `Song`, `Album`, `Playlist`, `Artist`, `HomeFeed`, `SearchResults`, `Lyrics`, `BrowseEntity` discriminated union, `ApiResponse<T>` envelope. Imported by both sides.
- [x] **1.4 Backend libs** — `env.ts`, `errors.ts`, `text.ts`, `des.ts` (pure-JS DES + PKCS5 strip + quality variants), `saavnClient.ts`, `lookup.ts`.
- [x] **1.5 Normalizers** — song/album/playlist/artist + polymorphic `normalizeEntity` dispatching on `type`.
- [x] **1.6 Routes** — health, home, search (+suggest), songs, albums, playlists, artists, lyrics; async wrapper + terminal error middleware.
- [x] **1.7 Entries & Vercel config** — `app.ts` factory, `api/index.ts` (`export default app`), `server.ts` (dev listener), `vercel.json` rewrites, `.env.example`, `README.md`.
- [x] **1.8 Verify backend** — every route exercised against the live API; error paths (404/400/502/504) and resilience confirmed by execution.

## Checkpoint A — Player core ✅ BUILT, ⛔ AWAITING REVIEW

- [x] **2.1 `usePlayerStore`** — queue machine, shuffle with order restore, repeat modes, partialized persistence with rehydration guard.
- [x] **2.2 `usePlayer.ts`** — Howler `html5: true` lifecycle; `MediaElementSource → Analyser → destination` bridge with `WeakMap` guard; rAF position loop; drag-aware seeking; graceful visualiser degradation.
- [x] **2.3 `PlayerBar.tsx`** — three-region bar per L4, marquee overflow title, draggable green seek bar, analyser-driven equalizer.

Verified in a real browser (28/28 checks): playback, direct-CDN 320kbps streaming,
`crossOrigin` set pre-fetch, live analyser on tracks 1 AND 2, seek, queue advance,
pause, persistence, paused-on-refresh restore, clean console.

Two bugs found and fixed during verification:
- A seek/`load` feedback loop that reverted every seek (see `usePlayer.ts` notes).
- One-time pool priming handed track 2 a non-CORS element, silently killing the
  visualiser after the first track.

**Stop and present before any further UI.**

## Remaining stages — each pauses for review

- [x] **Stage 3 — Home** ✅ BUILT, ⛔ AWAITING REVIEW — app shell (sidebar, navbar, routing),
      carousels, recently played, card hover play, skeletons + error/retry.
      Browser-verified 26/26: skeletons precede content (0 spinners), all four carousels,
      click-to-play from cards AND from live search suggestions, card→detail navigation,
      deep-link survival, retry recovering from a simulated 502, clean console.

      Bug found and fixed: `autocomplete.get` (which backs navbar suggestions) omits
      `encrypted_media_url` and `duration`, so suggestion songs were unplayable
      (`downloadUrl: []`). Songs are now lazily resolved via `/songs/:id` at play time
      rather than enriching every suggestion server-side.

      Interim pages: `/search` (Stage 4), `/album|/playlist|/artist` (Stage 5),
      `/liked` + `/library` (Stage 8). All fetch real data and can play — not dead ends.
- [x] **Stage 4 — Search** ✅ — debounced navbar suggestions with out-of-order discard, grouped
      results page, URL-synced query + type filter, empty state distinct from error.
- [x] **Stage 5 — Detail pages** ✅ — album/playlist/artist banner + tracklist, play-from-index,
      context menus. Album `header_desc` suppressed because upstream restates the metadata.
- [x] **Stage 6 — Queue** ✅ — queue panel (now playing + next up), Add to Queue, Play Next,
      remove, clear, jump-to-track.
- [x] **Stage 7 — Lyrics** ✅ — static side panel, newline rendering, neutral empty state,
      never gated on the unreliable `hasLyrics` flag.
- [x] **Stage 8 — Liked Songs** ✅ — like toggles in rows/player/fullscreen, auto collection,
      Your Library with history.
- [x] **Stage 9 — Mobile & polish** ✅ — collapsible sidebar, swipe-up/down fullscreen player
      (hand-rolled pointer-event swipe, no gesture dependency), Escape to dismiss.
- [x] **Stage 10 — Deployment checklist** ✅ — `DEPLOYMENT.md`: local run, Vercel dashboard
      config, post-deploy verification, known limitations, troubleshooting table.

Browser-verified 27/27 across stages 4-9: URL-synced search + filters, empty-vs-error states,
play from results, real lyrics rendered with no timing markup, shared right rail (opening queue
closes lyrics), album banner + 10-row tracklist, context-menu Add to Queue (20 -> 21), like
persistence, Liked Songs + Library, artist page with circular art and four sections, 404 route,
mobile fullscreen player with Escape dismissal, playback unaffected by the overlay, clean console.

Two items came out of verification: the search filter row gained `role="group"` semantics, and
`Skeleton` now takes a `style` prop instead of a props-spread hack.

## Intentionally not built

- **Recommendations / radio autoplay** (`song.getReco`) — never in the requirements; the queue
  simply ends. The obvious next feature if endless playback is wanted.
- **Colour-sampled banner gradients** — would need a canvas read of a cross-origin image plus a
  contrast check to keep white text legible. A fixed tint gets most of the effect, none of the risk.
- **Legacy Flask files** (`app.py`, `helpers.py`, `models.py`, `requirements.txt`) left in place
  rather than deleted without approval. Unused by the app.
