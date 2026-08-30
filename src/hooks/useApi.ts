import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * Minimal typed data-fetching hook.
 *
 * Returns exactly the four things every async region in the UI needs, so
 * skeleton / error / empty / loaded branching looks identical everywhere
 * (requirement R8).
 */
export interface QueryState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  retry: () => void;
}

/**
 * @param path API path, or `null` to skip fetching entirely (used for
 *   conditional queries like search, which should not fire on an empty term).
 */
export function useApi<T>(path: string | null): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true when there IS a path, so the first paint is a skeleton rather
  // than a flash of empty state.
  const [isLoading, setIsLoading] = useState<boolean>(path !== null);

  /** Bumped by `retry()` to re-run the effect without changing `path`. */
  const [attempt, setAttempt] = useState(0);

  /**
   * Monotonic request id.
   *
   * Guards against out-of-order responses: a slow earlier request must never
   * overwrite a faster later one (requirement R2.3). Abort alone is not
   * sufficient — a response can already be in flight when abort fires.
   */
  const latestRequest = useRef(0);

  useEffect(() => {
    if (path === null) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    apiFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        if (requestId !== latestRequest.current) return; // superseded
        setData(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (requestId !== latestRequest.current) return;

        setError(cause instanceof Error ? cause.message : 'Something went wrong.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [path, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, isLoading, retry };
}
