import { Howl, Howler } from 'howler';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioQuality, DownloadLink, Song } from '@shared/types';
import {
  RESTART_THRESHOLD_SECONDS,
  selectCurrentTrack,
  usePlayerStore,
  type QualityPreference,
} from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { clamp } from '@/lib/utils';

/**
 * The audio engine: the only module that talks to Howler or Web Audio.
 *
 * `usePlayerStore` holds intent; this hook makes reality match it. Everything
 * lives at module scope rather than in React state because there must be
 * exactly one `<audio>` element for the whole app — a second one would play two
 * tracks at once, and remounting would restart playback.
 *
 *
 * ── Why html5:true AND a Web Audio analyser ─────────────────────────────────
 *
 * These two requirements pull in opposite directions:
 *
 *   • Streaming + seeking require `html5: true`. Howler's Web Audio mode
 *     (`html5: false`) downloads the ENTIRE file before playing, which is
 *     unacceptable for streaming and breaks range-request seeking.
 *   • The equalizer needs an `AnalyserNode`, which only exists in Web Audio.
 *     Howler's `masterGain` is only populated in `html5: false` mode.
 *
 * Resolution: keep `html5: true` and bridge the underlying `<audio>` element
 * into the Web Audio graph ourselves:
 *
 *     <audio> → MediaElementAudioSourceNode → AnalyserNode → ctx.destination
 *
 * Three hazards make this fiddly, all handled below:
 *   1. `createMediaElementSource` THROWS if called twice on the same element,
 *      and Howler pools/reuses elements → guarded by a WeakMap.
 *   2. Once routed through Web Audio, the element no longer reaches the
 *      speakers implicitly → the chain MUST terminate at `destination`.
 *   3. A CORS-tainted element produces silence AND all-zero analyser data →
 *      we only bridge elements we know carry `crossOrigin="anonymous"`.
 */

/* ------------------------------------------------------------------ *
 * Module-scope engine state
 * ------------------------------------------------------------------ */

let howl: Howl | null = null;
/** Track id currently loaded into `howl`, to avoid needless reloads. */
let loadedTrackId: string | null = null;

let analyser: AnalyserNode | null = null;
let analyserBuffer: Uint8Array | null = null;

/**
 * Cached AudioContext. MUST be a single stable instance — see `getAudioContext`
 * for why resolving it per-call caused silent playback.
 */
let audioCtx: AudioContext | null = null;

/**
 * Elements already wired into the audio graph.
 *
 * `createMediaElementSource` throws on a second call for the same element, and
 * Howler recycles elements through `_html5AudioPool`, so the same node WILL
 * come back around. A WeakMap lets the entry disappear with the element.
 */
const bridgedElements = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/** Once the visualiser is known to be unavailable, stop retrying every track. */
let visualiserDisabled = false;

/**
 * iOS deliberately never gets the Web Audio bridge.
 *
 * On iOS Safari, routing an HTML5 `<audio>` element through
 * `createMediaElementSource` frequently produces NO OUTPUT AT ALL — and it does
 * so without throwing, so the safety-net fallback cannot detect it. Playback is
 * the product; the equalizer is decoration. On iOS the bars sit idle and audio
 * plays natively, which is the correct trade.
 *
 * iPadOS reports itself as "Macintosh", so touch support is used to catch it.
 */
function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Track whose persisted position has already been restored.
 *
 * Guards against Howler re-emitting `load` (which it does on every
 * seek-while-playing) turning a one-shot restore into a seek feedback loop.
 */
let restoredForTrackId: string | null = null;

/** True while the user drags the seek bar — suspends position writes. */
let isScrubbing = false;

let poolPrimed = false;

/**
 * Position to seek to once the next load completes.
 *
 * Set when we reload a track at a different bitrate, so an adaptive downgrade
 * resumes where the listener was instead of restarting the song.
 */
let pendingSeekTo: number | null = null;

/** Detaches the current stall listeners. Reset on every load. */
let detachStallWatch: (() => void) | null = null;

/**
 * Track already written to listening history.
 *
 * Guards a synchronous localStorage write from running on every `play` event,
 * which on a rebuffering connection fires continuously.
 */
let recordedPlayForTrackId: string | null = null;

/* ------------------------------------------------------------------ *
 * Howler internals we have to reach into
 * ------------------------------------------------------------------ */

interface HowlInternals {
  _sounds?: Array<{ _node?: HTMLAudioElement }>;
}

interface HowlerInternals {
  _html5AudioPool?: Array<HTMLAudioElement & { _unlocked?: boolean }>;
  html5PoolSize?: number;
  ctx?: AudioContext;
  usingWebAudio?: boolean;
  /** Which media event Howler treats as "loaded". See `configureHowlerForStreaming`. */
  _canPlayEvent?: string;
}

/**
 * Makes Howler treat `canplay` — not `canplaythrough` — as loaded.
 *
 * This is the single biggest cause of "the song takes forever / keeps cutting
 * out" on a slow connection.
 *
 * Howler defaults `_canPlayEvent` to `canplaythrough`, which the browser fires
 * only once it believes it can play the ENTIRE file without stopping. Our tracks
 * are 8–15 MB, so at ~28 kB/s that estimate is minutes away — and because
 * playback is started from Howler's `load` handler, nothing plays until then.
 * Measured directly: at 28 kB/s the track never started at all.
 *
 * `canplay` fires as soon as there is enough buffered to begin, which is how
 * streaming is supposed to work: start now, keep filling the buffer while
 * playing. The stall watcher then handles the case where the connection genuinely
 * cannot sustain the chosen bitrate.
 */
function configureHowlerForStreaming(): void {
  const internals = Howler as unknown as HowlerInternals;
  if (internals._canPlayEvent === 'canplaythrough') {
    internals._canPlayEvent = 'canplay';
  }
}

/** The `<audio>` element backing a Howl in html5 mode. */
function getMediaElement(instance: Howl): HTMLAudioElement | null {
  return (instance as unknown as HowlInternals)._sounds?.[0]?._node ?? null;
}

/**
 * Ensures every element in Howler's HTML5 audio pool has
 * `crossOrigin="anonymous"`. MUST be called before each `new Howl()`.
 *
 * This is the ONLY reliable place to set it. Inside Howler's `Sound.create()`
 * the sequence
 *
 *     node = Howler._obtainHtml5Audio();  node.src = ...;  node.load();
 *
 * runs synchronously, so by the time `new Howl()` returns the media fetch has
 * already been kicked off — setting `crossOrigin` afterwards is too late to
 * affect the request, and a tainted element yields a silent, all-zero graph.
 *
 * Why re-run this every time instead of priming once:
 *
 *   Howler's `unlock()` handler fires on the first user gesture and tops the
 *   pool up to `html5PoolSize` with plain `new Audio()` elements that have no
 *   crossOrigin. Because `_obtainHtml5Audio()` uses `pop()`, those late
 *   additions sit at the END of the array and are handed out FIRST. Priming
 *   once was verified to work for track 1 and then hand track 2 an
 *   unconfigured element — silently disabling the visualiser for the rest of
 *   the session. Re-sweeping the pool (≤10 elements) before each load is cheap
 *   and immune to Howler topping it up behind us.
 */
function ensureHtml5AudioPoolCors(): void {
  try {
    const internals = Howler as unknown as HowlerInternals;
    const pool = internals._html5AudioPool;
    if (!pool) return;

    // Re-sweep: covers elements Howler added after our last pass.
    for (const element of pool) {
      if (element.crossOrigin !== 'anonymous') element.crossOrigin = 'anonymous';
    }

    // Top up once with our own CORS-enabled elements so the pool is never
    // exhausted (an exhausted pool makes Howler mint an unconfigured Audio).
    if (!poolPrimed) {
      poolPrimed = true;
      const target = internals.html5PoolSize ?? 10;
      while (pool.length < target) {
        const element = new Audio() as HTMLAudioElement & { _unlocked?: boolean };
        element.crossOrigin = 'anonymous';
        // Mirrors what Howler's own unlock routine does when filling the pool.
        element._unlocked = true;
        pool.push(element);
      }
    }
  } catch {
    // Best-effort: playback works without it, the visualiser just stays idle.
  }
}

/**
 * The shared AudioContext, resolved once and CACHED.
 *
 * Caching is load-bearing, not an optimisation. This used to resolve on every
 * call, returning `Howler.ctx` when it existed and otherwise minting a fresh
 * context. If the first call happened before Howler initialised its context, the
 * AnalyserNode ended up on our context while a later `createMediaElementSource`
 * used Howler's. Connecting nodes across two AudioContexts throws
 * `InvalidAccessError` — and because the element had ALREADY been rerouted into
 * the graph by then, the audio had nowhere to go and playback went silent.
 */
function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;

  const internals = Howler as unknown as HowlerInternals;
  if (internals.ctx) {
    audioCtx = internals.ctx;
    return audioCtx;
  }

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioCtx = Ctor ? new Ctor() : null;
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Routes an element through an AnalyserNode.
 *
 * Bails out unless the element is explicitly CORS-enabled: bridging a tainted
 * element would not merely produce a flat visualiser, it would MUTE playback.
 * Silent audio is a far worse failure than a static equalizer, so when in doubt
 * we leave the element alone and let it play natively (requirement R9.3).
 */
function bridgeToAnalyser(element: HTMLAudioElement): void {
  if (visualiserDisabled) return;

  // See `isIosLike`: bridging there can silence playback with no error to catch.
  if (isIosLike()) {
    visualiserDisabled = true;
    return;
  }

  /**
   * Skip THIS track, but do not disable the visualiser permanently.
   *
   * A single unconfigured element (e.g. Howler minted one outside the pool)
   * should cost one track's bars, not the whole session's.
   */
  if (element.crossOrigin !== 'anonymous') return;

  const ctx = getAudioContext();
  if (!ctx) {
    visualiserDisabled = true;
    return;
  }

  /**
   * STEP 1 — obtain the source node.
   *
   * Isolated in its own try/catch because it is the point of no return:
   * `createMediaElementSource` permanently reroutes the element's audio away
   * from the speakers and into the graph. If it THROWS, the element is untouched
   * and still audible, so bailing out here is safe.
   */
  let source = bridgedElements.get(element);
  if (!source) {
    try {
      source = ctx.createMediaElementSource(element);
      bridgedElements.set(element, source);
    } catch {
      // Element never entered the graph — it keeps playing natively.
      visualiserDisabled = true;
      return;
    }
  }

  /**
   * STEP 2 — wire it to an output.
   *
   * From here the element is audible ONLY via `source`, so this MUST terminate
   * at the destination. Any failure falls back to connecting straight to output:
   * a dead visualiser is a cosmetic bug, silent playback is a broken app.
   */
  try {
    if (!analyser) {
      const node = ctx.createAnalyser();
      // 64 bins is plenty for ~20 bars and keeps the per-frame copy cheap.
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.8;
      node.connect(ctx.destination);

      analyser = node;
      analyserBuffer = new Uint8Array(node.frequencyBinCount);
    }
    source.connect(analyser);
  } catch {
    try {
      // Safety net: keep the audio audible even though analysis failed.
      source.connect(ctx.destination);
    } catch {
      // Nothing further we can do; surfaced below rather than silently swallowed.
      console.error('[sur] audio graph could not reach the output device');
    }
    visualiserDisabled = true;
  }
}

/** Resumes the context, which starts suspended until a user gesture. */
function resumeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

function teardownHowl(): void {
  detachStallWatch?.();
  detachStallWatch = null;

  if (!howl) return;
  try {
    howl.off();
    howl.unload();
  } catch {
    // Unloading a partially-initialised Howl can throw; nothing to recover.
  }
  howl = null;
  loadedTrackId = null;
}

/**
 * Watches for rebuffering and reports when the stream cannot keep up.
 *
 * `waiting` fires whenever playback halts for data. One is unremarkable — it
 * happens after a seek, or on a brief network dip. Repeated ones inside a short
 * window mean the bitrate is genuinely too high for the connection, which is the
 * signal to downgrade.
 *
 * Listeners are attached to the pooled element and MUST be removed on teardown,
 * because Howler recycles elements and they would otherwise accumulate.
 */
function watchForStalls(element: HTMLAudioElement, onStalling: () => void): () => void {
  const STALL_THRESHOLD = 2;
  const WINDOW_MS = 20_000;

  let timestamps: number[] = [];

  const onWaiting = (): void => {
    // Ignore stalls before playback has really begun; initial buffering is not
    // evidence of a sustained bandwidth problem.
    if (element.currentTime < 1.5) return;

    const now = Date.now();
    timestamps = timestamps.filter((t) => now - t < WINDOW_MS);
    timestamps.push(now);

    if (timestamps.length >= STALL_THRESHOLD) {
      timestamps = [];
      onStalling();
    }
  };

  element.addEventListener('waiting', onWaiting);
  return () => element.removeEventListener('waiting', onWaiting);
}

/* ------------------------------------------------------------------ *
 * Quality selection
 * ------------------------------------------------------------------ */

interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  saveData?: boolean;
}

/**
 * Best starting quality for `auto`, estimated from the connection.
 *
 * NOT the highest available. A 320kbps track measures 8–15 MB, and always
 * choosing it is what makes playback stutter on anything short of a fast
 * connection — the browser cannot keep the buffer ahead of the playhead. 160kbps
 * is roughly half the bytes and the safe default; 320 is only chosen when the
 * connection is measurably fast.
 *
 * The Network Information API is Chromium-only, so absence is normal and simply
 * means we stay on the safe default rather than gambling on 320.
 */
function autoQuality(): AudioQuality {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

  if (!connection) return '160kbps';
  if (connection.saveData) return '96kbps';

  switch (connection.effectiveType) {
    case 'slow-2g':
    case '2g':
      return '96kbps';
    case '3g':
      return '160kbps';
    default:
      break;
  }

  // `downlink` is a rounded Mbps estimate. 5 Mbps comfortably sustains 320kbps.
  return typeof connection.downlink === 'number' && connection.downlink >= 5
    ? '320kbps'
    : '160kbps';
}

/** Index into `downloadUrl` (ascending) for a requested quality. */
function baseQualityIndex(links: DownloadLink[], preference: QualityPreference): number {
  if (links.length === 0) return -1;

  const target = preference === 'auto' ? autoQuality() : preference;
  const exact = links.findIndex((link) => link.quality === target);
  if (exact >= 0) return exact;

  // Requested bitrate not offered for this track — take the best below it.
  return links.length - 1;
}

/**
 * Resolves the URL to stream, applying the preference and any downgrades.
 *
 * `stepsDown` is applied on top of the preference so a stalling or failing
 * stream can walk down the ladder without discarding what the listener asked for.
 */
function resolveStream(
  song: Song,
  preference: QualityPreference,
  stepsDown: number,
): { url: string; quality: AudioQuality; index: number } | null {
  const links = song.downloadUrl;
  const base = baseQualityIndex(links, preference);
  if (base < 0) return null;

  const index = Math.max(base - stepsDown, 0);
  const link = links[index];
  return link ? { url: link.url, quality: link.quality, index } : null;
}

/* ------------------------------------------------------------------ *
 * Engine hook — mount EXACTLY once, above the router
 * ------------------------------------------------------------------ */

export function usePlayerEngine(): void {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);

  const recordPlay = useLibraryStore((s) => s.recordPlay);
  const frameRef = useRef<number | null>(null);

  const qualityPreference = usePlayerStore((s) => s.qualityPreference);
  const reportQuality = usePlayerStore((s) => s.reportQuality);

  /**
   * How many quality notches below the requested one we are currently using.
   *
   * Bumped by `loaderror` (URL unavailable) and by the stall watcher (bitrate too
   * high for the connection). Reset per track and whenever the preference changes.
   */
  const [qualityStepsDown, setQualityStepsDown] = useState(0);

  const trackId = currentTrack?.id ?? null;
  const stream = currentTrack
    ? resolveStream(currentTrack, qualityPreference, qualityStepsDown)
    : null;
  const streamUrl = stream?.url ?? null;

  // A new track, or a newly chosen preference, starts without any downgrade.
  useEffect(() => {
    setQualityStepsDown(0);
  }, [trackId, qualityPreference]);

  // Surface what is actually streaming so the UI can show it honestly.
  useEffect(() => {
    reportQuality(stream?.quality ?? null, qualityStepsDown > 0);
  }, [stream?.quality, qualityStepsDown, reportQuality]);

  /* ── load / unload on track change ───────────────────────────────────── */
  useEffect(() => {
    const store = usePlayerStore.getState();

    if (!currentTrack || trackId === null) {
      teardownHowl();
      return;
    }

    // Already loaded (e.g. a re-render or an unrelated store change).
    if (loadedTrackId === trackId && howl) return;

    if (streamUrl === null) {
      // Decryption failed upstream — surface it instead of hanging on a
      // never-loading player (requirement R3.8).
      teardownHowl();
      store.setStatus('error', 'This track has no playable audio source.');
      store.setPlaying(false);
      return;
    }

    teardownHowl();
    // Both must run before `new Howl()`: the element's src is assigned
    // synchronously inside the constructor, and the load-event choice is read
    // when its listeners are attached there.
    ensureHtml5AudioPoolCors();
    configureHowlerForStreaming();

    store.setStatus('loading');

    const instance = new Howl({
      src: [streamUrl],
      // Streaming mode: starts on first bytes and seeks via range requests.
      html5: true,
      format: ['mp4', 'm4a', 'aac'],
      volume: isMuted ? 0 : volume,
      // Howler's own HTML5 fade uses a timer that fights our rAF loop.
      preload: true,
    });

    howl = instance;
    loadedTrackId = trackId;

    instance.on('load', () => {
      if (howl !== instance) return;
      const latest = usePlayerStore.getState();

      // Prefer the element's real duration; fall back to API metadata while the
      // browser still reports 0/Infinity for a stream.
      const reported = instance.duration();
      latest.setDuration(
        Number.isFinite(reported) && reported > 0 ? reported : currentTrack.duration,
      );
      latest.setStatus('ready');

      /**
       * Restore a persisted position — ONCE per track (requirement R6.1).
       *
       * The once-guard is essential, not defensive. Howler's seek-while-playing
       * performs `pause() → set currentTime → play()`, and that re-emits `load`.
       * Without the guard this restore fires again on every user seek and drags
       * playback back to `store.position`, which the rAF loop may still hold as
       * a pre-seek value — an infinite seek/play feedback loop (observed as
       * thousands of `seeking/seeked/playing` events at a frozen position).
       */
      if (pendingSeekTo !== null) {
        // Reloaded at a different bitrate: continue from where playback was.
        const target = pendingSeekTo;
        pendingSeekTo = null;
        if (target > 0 && target < instance.duration()) instance.seek(target);
      } else if (
        restoredForTrackId !== trackId &&
        latest.position > 0 &&
        latest.position < instance.duration()
      ) {
        instance.seek(latest.position);
      }
      restoredForTrackId = trackId;

      /**
       * `!instance.playing()` is essential, not belt-and-braces.
       *
       * Since `load` is now bound to `canplay`, it fires REPEATEDLY on a slow
       * connection — every time the buffer recovers and readyState climbs back to
       * HAVE_FUTURE_DATA. Calling `play()` unconditionally on each one restarted
       * the play pipeline dozens of times a second and froze the main thread.
       */
      if (latest.isPlaying && !instance.playing()) {
        resumeAudioContext();
        instance.play();
      }
    });

    instance.on('play', () => {
      if (howl !== instance) return;
      resumeAudioContext();

      const element = getMediaElement(instance);
      if (element) {
        bridgeToAnalyser(element);

        // Attach once per load; teardown removes it before the element is reused.
        if (!detachStallWatch) {
          detachStallWatch = watchForStalls(element, () => {
            const song = usePlayerStore.getState().queue[usePlayerStore.getState().queueIndex];
            if (!song) return;

            const current = resolveStream(song, qualityPreference, qualityStepsDown);
            const lower = resolveStream(song, qualityPreference, qualityStepsDown + 1);

            // Already at the bottom — nothing left to trade away.
            if (!lower || !current || lower.index === current.index) return;

            console.warn(
              `[sur] repeated rebuffering at ${current.quality}; ` +
                `switching to ${lower.quality} to keep playback smooth`,
            );

            // Resume where the listener is, rather than restarting the track.
            pendingSeekTo = element.currentTime;
            setQualityStepsDown((steps) => steps + 1);
          });
        }
      }

      usePlayerStore.getState().setStatus('ready');

      /**
       * Record the play ONCE per loaded track.
       *
       * `play` fires on every resume — including each recovery from rebuffering,
       * which on a slow link is constant. `recordPlay` rebuilds the history array
       * and Zustand's persist middleware then does a SYNCHRONOUS
       * `localStorage.setItem` of up to 30 full song objects. Running that on
       * every buffer recovery is what pegged the main thread and froze the UI.
       */
      if (recordedPlayForTrackId !== trackId) {
        recordedPlayForTrackId = trackId;
        recordPlay(currentTrack);
      }
    });

    instance.on('end', () => {
      if (howl !== instance) return;
      const latest = usePlayerStore.getState();

      if (latest.repeat === 'one') {
        // Replay in place rather than walking the queue (requirement R3.4).
        instance.seek(0);
        latest.setPosition(0);
        instance.play();
        return;
      }
      latest.next({ auto: true });
    });

    instance.on('loaderror', () => {
      if (howl !== instance) return;
      const latest = usePlayerStore.getState();

      /**
       * Try a lower bitrate before giving up.
       *
       * The five quality URLs are synthesised by filename substitution, so a
       * higher one can 404 or be unavailable on a given network while a smaller
       * one plays fine. Previously any load failure ended playback with an error
       * and silence; now it walks down the ladder first.
       */
      const lower = resolveStream(currentTrack, qualityPreference, qualityStepsDown + 1);
      if (lower && stream && lower.index !== stream.index) {
        console.warn(
          `[sur] "${currentTrack.title}" failed to load at ${stream.quality}; ` +
            `retrying at ${lower.quality}`,
        );
        setQualityStepsDown((steps) => steps + 1);
        return;
      }

      latest.setStatus('error', 'Could not load this track. It may be unavailable.');
      // Deliberately do NOT auto-skip: during an outage that would burn through
      // the whole queue in seconds.
      latest.setPlaying(false);
    });

    instance.on('playerror', () => {
      if (howl !== instance) return;
      const latest = usePlayerStore.getState();
      // Almost always the browser's autoplay policy. Park in a paused state the
      // user can resolve with one click.
      latest.setPlaying(false);
      latest.setStatus('ready');
    });

    return () => {
      if (howl === instance) teardownHowl();
    };
    // `volume`/`isMuted` are intentionally excluded: they are applied by the
    // effect below, and including them here would reload the track on every
    // volume nudge. `streamUrl` covers `qualityStepsDown`, so a downgrade
    // re-runs this effect and reloads at the lower bitrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, streamUrl, recordPlay]);

  /* ── play / pause ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!howl) return;

    if (isPlaying) {
      if (!howl.playing()) {
        resumeAudioContext();
        howl.play();
      }
    } else if (howl.playing()) {
      howl.pause();
    }
  }, [isPlaying, trackId]);

  /* ── volume / mute ───────────────────────────────────────────────────── */
  useEffect(() => {
    howl?.volume(isMuted ? 0 : volume);
  }, [volume, isMuted, trackId]);

  /* ── position loop ───────────────────────────────────────────────────── */
  useEffect(() => {
    // Only runs while audible: a permanent interval would keep waking the main
    // thread (and re-rendering the seek bar) on an idle tab.
    if (!isPlaying) return;

    const tick = (): void => {
      /**
       * Read position from the media element, NOT `howl.seek()`.
       *
       * `Howl.seek()` returns Howler's internal `_seek` bookkeeping, which holds
       * a STALE pre-seek value while a seek is in flight (Howler pauses,
       * re-points and replays the element). Writing that back into the store
       * reverted every user seek. The element's own `currentTime` is the ground
       * truth and has no such transitional state.
       *
       * `element.seeking` is also skipped: during a seek the browser briefly
       * reports the old time, which would flicker the progress bar backwards.
       */
      if (howl && !isScrubbing) {
        const element = getMediaElement(howl);
        if (element && !element.seeking && !element.paused) {
          const { currentTime } = element;
          if (Number.isFinite(currentTime)) {
            usePlayerStore.getState().setPosition(currentTime);
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [isPlaying, trackId]);

  /* ── media session + keyboard ────────────────────────────────────────── */
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artistNames,
      album: currentTrack.album?.name ?? '',
      artwork: currentTrack.image ? [{ src: currentTrack.image, sizes: '500x500' }] : [],
    });

    const store = usePlayerStore.getState();
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ['play', () => store.setPlaying(true)],
      ['pause', () => store.setPlaying(false)],
      ['previoustrack', () => store.previous()],
      ['nexttrack', () => store.next()],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Not every browser supports every action.
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  /* ── unload on app teardown ──────────────────────────────────────────── */
  useEffect(() => () => teardownHowl(), []);
}

/* ------------------------------------------------------------------ *
 * Controls — usable from any component
 * ------------------------------------------------------------------ */

export interface PlayerControls {
  seekTo: (seconds: number) => void;
  beginScrub: () => void;
  endScrub: (seconds: number) => void;
  /** "Previous" with the restart-vs-step-back rule applied. */
  previousOrRestart: () => void;
}

export function usePlayerControls(): PlayerControls {
  const seekTo = useCallback((seconds: number) => {
    const store = usePlayerStore.getState();
    const max = store.duration > 0 ? store.duration : Number.MAX_SAFE_INTEGER;
    const target = clamp(seconds, 0, max);

    store.setPosition(target);
    if (howl) howl.seek(target);
  }, []);

  // While dragging, the rAF loop must stop writing position — otherwise a stale
  // frame yanks the thumb backwards mid-gesture (requirement R3.6).
  const beginScrub = useCallback(() => {
    isScrubbing = true;
  }, []);

  const endScrub = useCallback(
    (seconds: number) => {
      seekTo(seconds);
      isScrubbing = false;
    },
    [seekTo],
  );

  const previousOrRestart = useCallback(() => {
    const store = usePlayerStore.getState();

    // Past the threshold, "previous" restarts the current track rather than
    // skipping back — matching every mainstream player (requirement R3.2).
    if (store.position > RESTART_THRESHOLD_SECONDS) {
      seekTo(0);
      return;
    }
    store.previous();
  }, [seekTo]);

  return { seekTo, beginScrub, endScrub, previousOrRestart };
}

/* ------------------------------------------------------------------ *
 * Analyser data for the equalizer
 * ------------------------------------------------------------------ */

/**
 * Samples the AnalyserNode once per frame and returns `barCount` levels in 0..1.
 *
 * Returns zeros when paused or when the visualiser is unavailable, so the
 * Equalizer renders a flat idle state with no branching at the call site
 * (requirements R9.2 / R9.3).
 */
export function useAnalyserLevels(barCount = 20): number[] {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [levels, setLevels] = useState<number[]>(() => new Array(barCount).fill(0));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setLevels(new Array(barCount).fill(0));
      return;
    }

    const tick = (): void => {
      if (analyser && analyserBuffer) {
        // `as never` bridges a TS DOM-lib mismatch: getByteFrequencyData is
        // typed for Uint8Array<ArrayBuffer> in newer libs.
        analyser.getByteFrequencyData(analyserBuffer as never);

        const bins = analyserBuffer.length;
        // Sample the lower ~70% of the spectrum; the top bins are near-silent
        // for most music and would render as permanently dead bars.
        const usable = Math.floor(bins * 0.7);
        const perBar = Math.max(1, Math.floor(usable / barCount));

        const next = new Array<number>(barCount);
        for (let bar = 0; bar < barCount; bar += 1) {
          let sum = 0;
          const start = bar * perBar;
          for (let i = 0; i < perBar; i += 1) {
            sum += analyserBuffer[start + i] ?? 0;
          }
          next[bar] = clamp(sum / perBar / 255, 0, 1);
        }
        setLevels(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [isPlaying, barCount]);

  return levels;
}

/** Whether a live analyser exists, so UI can label the bars honestly. */
export function isVisualiserActive(): boolean {
  return analyser !== null && !visualiserDisabled;
}
