import type { CubeMoveEvent, CubeMoveDirection, CubeOrientation } from '@cubeforge/types';

/**
 * Merges consecutive same-face same-direction CubeMoveEvents into X2 moves.
 *
 * The GAN Gen2 BLE protocol has no native encoding for 180° turns — a
 * physical D2 is reported as two separate 90° D events in the same packet.
 * This compacts them for analysis so move counts and TPS reflect the
 * solver's intent, not the BLE encoding.
 *
 * Only merges exact same-face+same-direction pairs (e.g. D + D → D2).
 * Different faces (M-slice: B+F') and cancelling pairs (D + D') are NOT
 * merged — those are distinct physical moves.
 *
 * IDEMPOTENCY: 180° moves (direction 2) are NEVER merged with another 180°
 * move. Two adjacent D2 are a redundant 360° turn (net identity), not a
 * single D2 (net 180°) — merging them would corrupt the cube state. This
 * also means re-running compaction on an already-compacted sequence (e.g.
 * re-analyzing a persisted solve) is a no-op: the stored compacted moves
 * come back unchanged.
 *
 * The orientations array is compacted in lockstep so downstream consumers
 * (e.g. TimelineBuilder) receive aligned arrays after merging.
 *
 * @example
 * compactCubeMoves([D, D, U, D', D']) // → { moves: [D2, U, D2'], orientations: [...] }
 * compactCubeMoves([B, F'])           // → { moves: [B, F'], orientations: [...] } (no merge, M-slice)
 */
export function compactCubeMoves(
  moves: CubeMoveEvent[],
  orientations?: (CubeOrientation | undefined)[],
): {
  moves: CubeMoveEvent[];
  orientations: (CubeOrientation | undefined)[];
} {
  if (moves.length === 0) {
    return { moves: [], orientations: orientations ?? [] };
  }

  const compactedMoves: CubeMoveEvent[] = [];
  const compactedOrientations: (CubeOrientation | undefined)[] = [];

  for (let i = 0; i < moves.length; i++) {
    const current = moves[i];

    // Look ahead: if next move is same face + same direction, merge into X2.
    // Only merge when BOTH halves agree on wide-ness (two identical wide
    // quarter-turns r + r → r2 stay a wide; a wide + plain face never merge
    // — they are different physical moves). The merged event preserves the
    // wide flag and the display label so the replay keeps animating both
    // layers together and labels it "r2".
    if (
      i + 1 < moves.length &&
      moves[i + 1].face === current.face &&
      moves[i + 1].direction === current.direction &&
      moves[i + 1].wide === current.wide &&
      // Only merge QUARTER turns. Two adjacent 180° moves (e.g. L2 L2 from
      // a four-identical-quarter-turn quad) are a redundant 360° turn, NOT
      // one 180° — merging them changes the net cube state. Excluding
      // direction 2 also makes compaction idempotent for persisted moves.
      current.direction !== 2
    ) {
      const next = moves[i + 1];
      compactedMoves.push({
        face: current.face,
        direction: 2 as CubeMoveDirection,
        wide: current.wide === true ? true : undefined,
        // A doubled wide keeps its display label ("r" + "r" → "r2").
        displayNotation: current.wide
          ? mergeWideDisplayNotation(current.displayNotation)
          : undefined,
        hostTimestamp: next.hostTimestamp,
        cubeTimestamp: next.cubeTimestamp,
      });
      // Use the orientation from the second sub-move (end of the 180° turn).
      compactedOrientations.push(orientations?.[i + 1]);
      i++; // skip the merged move
    } else {
      compactedMoves.push(current);
      compactedOrientations.push(orientations?.[i]);
    }
  }

  return { moves: compactedMoves, orientations: compactedOrientations };
}

/**
 * A doubled wide's display label: "r" + "r" → "r2" ("r'" + "r'" also →
 * "r2", since two CCW quarter-turns are a 180° turn; "r2" passes through).
 */
function mergeWideDisplayNotation(label: string | undefined): string | undefined {
  if (!label) return label;
  if (label.endsWith("2")) return label;
  if (label.endsWith("'")) return `${label.slice(0, -1)}2`;
  return `${label}2`;
}
