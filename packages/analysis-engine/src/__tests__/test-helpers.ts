import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';

/**
 * Create a mock CubeMoveEvent with sequential timestamps.
 */
export function makeMove(
  face: CubeFace,
  direction: CubeMoveDirection,
  index: number,
  baseTimestamp = 1000,
): CubeMoveEvent {
  return {
    face,
    direction,
    cubeTimestamp: baseTimestamp + index * 100,
    hostTimestamp: baseTimestamp + index * 100,
  };
}

/**
 * Create a sequence of moves from notation strings like "R", "U'", "L2".
 * Each move gets an incrementing timestamp starting at baseTimestamp.
 */
export function makeMoves(
  notation: string,
  baseTimestamp = 1000,
  gapMs = 100,
): CubeMoveEvent[] {
  const tokens = notation.trim().split(/\s+/);
  return tokens.map((token, i) => {
    const face = token[0] as CubeFace;
    let direction: CubeMoveDirection = 1;
    if (token.includes("'")) direction = -1;
    else if (token.includes("2")) direction = 2;

    return {
      face,
      direction,
      cubeTimestamp: baseTimestamp + i * gapMs,
      hostTimestamp: baseTimestamp + i * gapMs,
    };
  });
}
