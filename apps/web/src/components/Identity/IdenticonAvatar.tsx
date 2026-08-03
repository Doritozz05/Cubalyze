"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateCubeMarkSpec, renderCubeMark } from "@cubeforge/identicon";

export interface IdenticonAvatarProps {
  /** Stable seed — the anonymous user_id. Never the display name (D2). */
  seed: string;
  /** Pixel size (default 96). */
  size?: number;
  /** Tile background: theme-aware `--surface-2` (default) or transparent. */
  tile?: "transparent" | "surface-2";
  /** Tile shape — square/rounded-square by default (circle is available for
   *  round avatars via the package renderer). */
  shape?: "rounded" | "circle";
  className?: string;
}

/**
 * F2 (docs/plan_profile) — renders a CubeMark identicon as INLINE SVG so the
 * `var(--surface-2)` tile stays theme-aware (data-URIs can't resolve CSS
 * variables). Memoized on (seed, size, tile, shape); generation is ~0.01ms.
 *
 * The avatar is decorative: the display name renders next to it in text, so
 * the wrapper is `aria-hidden` and the SVG itself carries no role/label.
 * Callers pass `rounded-full` on className for the circular avatar frame.
 */
export function IdenticonAvatar({
  seed,
  size = 96,
  tile = "surface-2",
  shape = "rounded",
  className,
}: IdenticonAvatarProps) {
  const svg = useMemo(
    () => renderCubeMark(generateCubeMarkSpec(seed), { size, tile, shape }),
    [seed, size, tile, shape],
  );

  return (
    <div
      aria-hidden="true"
      className={cn("select-none overflow-hidden", className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
