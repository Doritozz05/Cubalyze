"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  /** Custom formatter (e.g. formatTime, toFixed). Defaults to Math.round. */
  format?: (n: number) => string;
  className?: string;
  /** Animation duration in seconds. */
  duration?: number;
}

/**
 * Count-up number that smoothly animates from its previous value to the
 * new one using framer-motion's `animate()` easing. Useful for PB heroes,
 * solve counts, and any metric that changes over time.
 *
 * The current animated value is tracked in a ref updated on every frame
 * (`onUpdate`), so that if `value` changes again before the previous
 * animation finishes, the next animation starts from the *actual* current
 * position — no visual jump or drift.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.4,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  // Always holds the latest animated value (updated every frame). This is
  // the correct "start from" source even if an animation is interrupted.
  const currentRef = useRef(value);

  useEffect(() => {
    const controls = animate(currentRef.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        currentRef.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span className={cn("nums", className)}>
      {format ? format(display) : Math.round(display)}
    </span>
  );
}
