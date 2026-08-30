import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 *
 * Used for the search box so a request is issued per pause in typing rather
 * than per keystroke (requirement R2.1).
 */
export function useDebounce<T>(value: T, delayMs = 275): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Cleanup on every change is what makes this a debounce rather than a
    // throttle: a keystroke inside the window restarts the clock.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
