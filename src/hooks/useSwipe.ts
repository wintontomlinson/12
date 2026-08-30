import { useRef } from 'react';

/**
 * Minimal vertical swipe detection.
 *
 * Hand-rolled on pointer events rather than adding a gesture library: the app
 * needs two gestures (swipe up to open the player, swipe down to dismiss it).
 *
 * Pointer events cover touch, pen and mouse with one code path. A distance
 * threshold plus a time limit is what separates a deliberate swipe from a slow
 * drag or a stray tap.
 */
export interface SwipeHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: () => void;
}

export function useSwipe({
  onSwipeUp,
  onSwipeDown,
  threshold = 60,
  maxDurationMs = 800,
}: {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  maxDurationMs?: number;
}): SwipeHandlers {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return {
    onPointerDown: (event) => {
      start.current = { x: event.clientX, y: event.clientY, t: Date.now() };
    },

    onPointerUp: (event) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;

      const dy = event.clientY - origin.y;
      const dx = event.clientX - origin.x;
      const elapsed = Date.now() - origin.t;

      if (elapsed > maxDurationMs) return;
      // Mostly-vertical only, so horizontal carousel swipes are not hijacked.
      if (Math.abs(dy) < threshold || Math.abs(dx) > Math.abs(dy)) return;

      if (dy < 0) onSwipeUp?.();
      else onSwipeDown?.();
    },

    onPointerCancel: () => {
      start.current = null;
    },
  };
}
