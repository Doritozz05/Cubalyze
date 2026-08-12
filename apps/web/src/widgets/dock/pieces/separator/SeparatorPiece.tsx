"use client";

/** Dock separator — thin vertical line divider between groups. */
export function SeparatorPiece() {
  // div (not span): `w-px`/`h-5` don't apply to inline elements — a span
  // would collapse to 0 width and the line would be invisible.
  return <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line/80" />;
}
