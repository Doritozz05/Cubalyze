/**
 * caseHelpers.ts — Shared helpers for the CFOP case table.
 *
 * Extracted verbatim from `OurDetectionPanel` so both Reconstructions and the
 * smart/virtual solve analysis render the exact same case table without
 * duplication. Pure functions + layout constants — no React.
 */
import { orderPairFaces } from "@cubalyze/math-core";
import { CASE_RENDER_GRAY } from "@cubalyze/algorithm-db";
import { FACE_HEX } from "@/components/Insights/atoms/faceColors";

/** Leading U moves (AUF-style) at the start of a move list. */
export function leadingU(moves: string[]): string[] {
  const auf: string[] = [];
  for (const m of moves) {
    if (m[0] === "U") auf.push(m);
    else break;
  }
  return auf;
}

/** Rotations of a phase, interleaved into the face moves at their position. */
export function interleave(
  moves: string[],
  rots: { token: string; moveIndex: number }[],
  from: number,
): string[] {
  if (moves.length === 0) return [];
  const sorted = [...rots].sort((a, b) => a.moveIndex - b.moveIndex);
  if (sorted.length === 0) return moves;
  const out: string[] = [];
  let ri = 0;
  for (let k = 0; k < moves.length; k++) {
    while (ri < sorted.length && sorted[ri].moveIndex <= from + k)
      out.push(sorted[ri++].token);
    out.push(moves[k]);
  }
  while (ri < sorted.length) out.push(sorted[ri++].token);
  return out;
}

/** Order pair colors for canonical FR mini-case render */
export function orderPairColors(
  a: string | undefined,
  b: string | undefined,
  crossColor?: string,
): [string | undefined, string | undefined] {
  if (a == null || b == null) return [a, b];
  return orderPairFaces(crossColor ?? "D", a, b);
}

/** Sticker colors for the 3D mini-case render of a pair. */
export function pairStickerColors(
  crossColor: string,
  leftColor: string,
  rightColor: string,
): Record<string, string> {
  return {
    U: CASE_RENDER_GRAY,
    D: FACE_HEX[crossColor] ?? crossColor,
    F: FACE_HEX[leftColor] ?? leftColor,
    R: FACE_HEX[rightColor] ?? rightColor,
    B: CASE_RENDER_GRAY,
    L: CASE_RENDER_GRAY,
  };
}

/** CSS rotation for AUF angle in 2D diagram */
export function aufRotationDeg(aufFace?: string): number {
  switch (aufFace) {
    case "R":
      return 90;
    case "B":
      return 180;
    case "L":
      return 270;
    default:
      return 0;
  }
}

// ─── Table Grid Layout Constants ────────────────────────────────────────────

export const GRID_CONTAINER =
  "grid min-w-[26rem] sm:min-w-0 grid-cols-[5.5rem_minmax(4.5rem,max-content)_1fr_2.25rem] sm:grid-cols-[6.5rem_minmax(5rem,max-content)_1fr_2.5rem] xl:grid-cols-[7.5rem_minmax(5.5rem,max-content)_1fr_2.75rem]";
export const ROW_GRID = "grid grid-cols-subgrid col-span-4";
export const ROW = "items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 transition-colors hover:bg-surface-2";
export const ROW_LINE = "border-b border-line";
