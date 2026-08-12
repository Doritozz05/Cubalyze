"use client";

/** Dock spacer — empty horizontal space between groups. */
export function SpacerPiece() {
  // div (not span): `w-3` doesn't apply to inline elements — a span would
  // collapse to 0 width and the spacer would be invisible.
  return <div aria-hidden className="w-3 shrink-0" />;
}
