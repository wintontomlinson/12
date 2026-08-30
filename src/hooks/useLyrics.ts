import type { Lyrics } from '@shared/types';
import { useApi } from './useApi';

/**
 * Fetches lyrics for a song.
 *
 * Deliberately does NOT consult `song.hasLyrics`. That flag is verifiably wrong:
 * `song.getDetails` reports `false` for "Tum Hi Ho" (`aRZbUYD7`) while
 * `lyrics.getLyrics` returns the real lyrics. Gating on it would hide lyrics that
 * exist, so the request is always attempted and the response decides.
 *
 * A track with no lyrics comes back as HTTP 200 with `lyrics: null`, which is a
 * neutral empty state rather than an error.
 */
export function useLyrics(songId: string | null): {
  lyrics: string | null;
  copyright: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
} {
  const { data, error, isLoading, retry } = useApi<Lyrics>(songId ? `/lyrics/${songId}` : null);

  return {
    lyrics: data?.lyrics ?? null,
    copyright: data?.copyright ?? null,
    isLoading,
    error,
    retry,
  };
}
