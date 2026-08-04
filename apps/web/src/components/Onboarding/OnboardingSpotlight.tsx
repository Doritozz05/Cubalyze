"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The dimming "hole" of the tour: an absolutely positioned box over the target
 * whose giant box-shadow darkens everything around it (single-node technique —
 * no 4-side divs). Spring-animated between steps so the mask visibly glides
 * from target to target.
 */
export function OnboardingSpotlight({ rect }: { rect: SpotlightRect | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={
        rect
          ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: 1,
            }
          : { opacity: 0 }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 38 }
      }
      className="pointer-events-none absolute rounded-xl border-2 border-line bg-transparent"
      // Pure neutral black veil — no blue channel (a slate tint looked off
      // against the app's canvas in both themes).
      style={{ boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)" }}
    />
  );
}
