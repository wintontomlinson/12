/**
 * Single source of truth for every shape crossing the API boundary.
 *
 * Imported by BOTH `api/` and `src/`, so a backend field rename surfaces as a
 * frontend compile error rather than a runtime `undefined`.
 *
 * Everything here is already normalized: camelCase keys, real numbers and
 * booleans (upstream sends `"192"` and `"true"` as strings), HTML entities
 * decoded, and artwork upgraded to 500x500.
 */

/* ------------------------------------------------------------------ *
 * Response envelope
 * ------------------------------------------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /**
     * Exception name and message for unexpected (`INTERNAL`) failures.
     *
     * Included in production deliberately. This API holds no secrets — the
     * upstream is public and unauthenticated — and an opaque "An unexpected
     * error occurred" made a live outage undiagnosable without platform log
     * access. Stack traces are still withheld.
     */
    detail?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'UPSTREAM_FAILURE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_MALFORMED'
  | 'INTERNAL';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Bitrates JioSaavn exposes. Derived from one decrypted URL by filename swap. */
export type AudioQuality = '12kbps' | '48kbps' | '96kbps' | '160kbps' | '320kbps';

export interface DownloadLink {
  quality: AudioQuality;
  url: string;
}

/** Lightweight artist reference embedded in songs and albums. */
export interface ArtistRef {
  id: string;
  name: string;
  /** Absent on many embedded references. */
  image: string | null;
  /** e.g. "singer", "music", "lyricist" — only present on detailed payloads. */
  role: string | null;
}

export interface AlbumRef {
  id: string;
  name: string;
  url: string | null;
}

/* ------------------------------------------------------------------ *
 * Core entities
 * ------------------------------------------------------------------ */

export interface Song {
  type: 'song';
  id: string;
  title: string;
  /** Upstream's pre-formatted "Artist - Album" line. */
  subtitle: string;
  /** jiosaavn.com permalink. */
  url: string | null;
  image: string | null;
  /** Track length in SECONDS (upstream sends a string). */
  duration: number;
  album: AlbumRef | null;
  artists: ArtistRef[];
  /** Comma-joined artist names, for compact single-line display. */
  artistNames: string;
  year: string | null;
  language: string | null;
  playCount: number | null;
  explicit: boolean;
  /**
   * Whether `GET /api/lyrics/:songId` will return content. Roughly half of
   * tracks have none — that is normal, not an error.
   */
  hasLyrics: boolean;
  label: string | null;
  /**
   * Playable CDN URLs, highest quality last. EMPTY when decryption failed —
   * callers must handle this rather than assuming `[0]` exists.
   */
  downloadUrl: DownloadLink[];
}

export interface Album {
  type: 'album';
  id: string;
  title: string;
  subtitle: string;
  url: string | null;
  image: string | null;
  year: string | null;
  language: string | null;
  playCount: number | null;
  explicit: boolean;
  songCount: number;
  artists: ArtistRef[];
  artistNames: string;
  description: string | null;
  /** Populated on the detail route; empty on carousel/search payloads. */
  songs: Song[];
}

export interface Playlist {
  type: 'playlist';
  id: string;
  title: string;
  subtitle: string;
  url: string | null;
  image: string | null;
  language: string | null;
  explicit: boolean;
  songCount: number;
  followerCount: number | null;
  description: string | null;
  /** Populated on the detail route; empty on carousel/search payloads. */
  songs: Song[];
}

export interface Artist {
  type: 'artist';
  id: string;
  name: string;
  image: string | null;
  url: string | null;
  followerCount: number | null;
  isVerified: boolean;
  bio: string | null;
  dominantLanguage: string | null;
  dominantType: string | null;
  topSongs: Song[];
  topAlbums: Album[];
  singles: Album[];
  similarArtists: ArtistRef[];
}

/* ------------------------------------------------------------------ *
 * Browse / carousels
 * ------------------------------------------------------------------ */

/**
 * Discriminated union for carousel items.
 *
 * Necessary because upstream sections are heterogeneous — `new_albums` was
 * verified to contain a `song` as its first element. Cards must route on
 * `entity.type`, never on which carousel they came from.
 */
export type BrowseEntity = Song | Album | Playlist | ArtistCard;

/** Artists as they appear in carousels: no nested song/album lists. */
export interface ArtistCard {
  type: 'artist';
  id: string;
  name: string;
  image: string | null;
  url: string | null;
  followerCount: number | null;
  isVerified: boolean;
}

export interface HomeSection {
  /** Stable machine key, e.g. `trending`. */
  id: HomeSectionId;
  /** Display label, e.g. "Trending Now". */
  title: string;
  items: BrowseEntity[];
}

export type HomeSectionId = 'trending' | 'newReleases' | 'topCharts' | 'madeForYou';

export interface HomeFeed {
  sections: HomeSection[];
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

export type SearchType = 'all' | 'song' | 'album' | 'artist' | 'playlist';

export interface SearchResults {
  query: string;
  songs: Song[];
  albums: Album[];
  artists: ArtistCard[];
  playlists: Playlist[];
}

/** Compact grouped payload for the navbar's live suggestions. */
export interface SearchSuggestions {
  query: string;
  top: BrowseEntity | null;
  songs: Song[];
  albums: Album[];
  artists: ArtistCard[];
  playlists: Playlist[];
}

/* ------------------------------------------------------------------ *
 * Lyrics
 * ------------------------------------------------------------------ */

export interface Lyrics {
  songId: string;
  /**
   * Plain text, newline-separated (upstream `<br>` already converted).
   * NULL when the track has no lyrics — a 200 response, not a 404.
   */
  lyrics: string | null;
  copyright: string | null;
  snippet: string | null;
}
