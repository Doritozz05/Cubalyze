"use client";

import { useEffect, useState } from "react";

/**
 * Delayed loading flag — kills skeleton flicker on fast loads.
 *
 * Returns true only when `pending` stays true longer than `delayMs`.
 * A fetch that resolves within the grace window never shows its fallback:
 * the UI goes straight from nothing to content instead of flashing a
 * skeleton/spinner for a frame or two.
 */
export function useLoadingGrace(pending: boolean, delayMs = 350): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  return show;
}
