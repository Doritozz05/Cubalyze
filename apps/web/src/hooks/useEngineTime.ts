"use client";

import { useEffect, useState } from "react";
import type { Observable } from "rxjs";

/**
 * Leaf subscription to an engine tick stream. Re-renders ONLY the calling
 * component per frame — the fix for the 3D-lag investigation: the previous
 * design piped every tick through `useSolveSession`'s `time` state, which
 * re-rendered App (and the whole stage incl. BottomLayout/widgets) ~12-60×/s
 * while inspecting/running and starved the three.js rAF loop.
 *
 * Lives in its own module (not useSolveSession) so leaf components don't
 * pull the session's heavy import chain.
 *
 * @param tick$ Stable tick observable (e.g. `session$.tick$`).
 * @param initial Value before the first tick (idle/stop snapshots).
 */
export function useEngineTime(
  tick$: Observable<number> | undefined,
  initial: number = 0,
): number {
  const [time, setTime] = useState(initial);
  useEffect(() => {
    if (!tick$) return;
    const sub = tick$.subscribe((t) => setTime(t));
    return () => sub.unsubscribe();
  }, [tick$]);
  return time;
}
