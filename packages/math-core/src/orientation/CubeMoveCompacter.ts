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
    if (
      i + 1 < moves.length &&
      moves[i + 1].face === current.face &&
      moves[i + 1].direction === current.direction
    ) {
      const next = moves[i + 1];
      compactedMoves.push({
        face: current.face,
        direction: 2 as CubeMoveDirection,
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
