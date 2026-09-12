"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateCubeMarkSpec, renderCubeMark } from "@cubeforge/identicon";

export interface IdenticonAvatarProps {
  /** Stable seed — the anonymous user_id. Never the display name (D2). */
  seed: string;
  /** Pixel size (default 96). */
  size?: number;
  /** Tile background: theme-aware `--surface-2` (default), its solid
   *  non-glass counterpart `--surface-2-solid`, or transparent. */
  tile?: "transparent" | "surface-2" | "surface-2-solid";
  className?: string;
}

/**
 * F2 (docs/plan_profile) — renders a CubeMark identicon as INLINE SVG so the
 * `var(--surface-2)` tile stays theme-aware (data-URIs can't resolve CSS
 * variables). Memoized on (seed, size, tile); generation is ~0.01ms.
 *
 * The glyph is pure square cells (no frames/overlays). The avatar is
 * decorative: the display name renders next to it in text, so the wrapper is
 * `aria-hidden` and the SVG itself carries no role/label. Callers pass the
 * corner radius (e.g. `rounded-xl`) on className for the frame.
 */
export function IdenticonAvatar({
  seed,
  size = 96,
  tile = "surface-2",
  className,
}: IdenticonAvatarProps) {
  // `tileRadius: 0` on purpose: this component always renders inside a frame
  // that already has a radius and clips it (`overflow-hidden`), so the tile must
  // reach the corners and let THAT radius do the rounding. Leaving the SVG's own
  // radius in place gave the tile a bigger curve than the frame (16px inside a
  // `rounded-xl` = 12px), and the frame's corners showed the page through the
  // sliver between the two — the mark looked like it did not fill its frame.
  const svg = useMemo(
    () => renderCubeMark(generateCubeMarkSpec(seed), { size, tile, tileRadius: 0 }),
    [seed, size, tile],
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
