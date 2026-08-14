import { OrientationTable } from './OrientationTable';
import type { OrientationTimeline } from '@cubeforge/types';
import type { CubeOrientation } from '@cubeforge/types';
import type { FacePermutation } from '@cubeforge/types';

/**
 * Compresses per-move orientation snapshots into an ultra-compact
 * keyframe timeline for storage.
 *
 * Each keyframe is a [moveIndex, orientationIndex] pair:
 * - moveIndex: index into the moves array where this orientation starts
 * - orientationIndex: 0-23 (index into OrientationTable.ENTRIES)
 *
 * Compression strategy:
 * - Only emits a new keyframe when orientation CHANGES
 * - Uses OrientationTable's numeric index (0-23, fits in 1 byte)
 * - First keyframe always at moveIndex=0
 *
 * For a typical CFOP solve with 2-3 rotations: 3-4 keyframes = ~16 bytes.
 * vs raw quaternions at 30Hz: 450+ samples × 32 bytes = 14KB+
 *
 * @param orientations - Per-move CubeOrientation snapshots (may contain undefined)
 * @returns Compact OrientationTimeline, or undefined if no valid orientations
 */
export function compactOrientationTimeline(
  orientations: (CubeOrientation | undefined)[],
): OrientationTimeline | undefined {
  if (orientations.length === 0) return undefined;

  const timeline: OrientationTimeline = [];
  let lastOrientationId: number | null = null;

  for (let i = 0; i < orientations.length; i++) {
    const orient = orientations[i];
    if (!orient) continue;

    // Look up the orientation in the table by faceMap
    const entry = OrientationTable.fromFaceMap(orient.faceMap);
    const id = entry.id;

    if (id === lastOrientationId) continue; // Same orientation, compress

    lastOrientationId = id;
    timeline.push([i, id]);
  }

  // Only return if we have at least one keyframe and it's not just identity
  if (timeline.length === 0) return undefined;
  // If the only keyframe is identity at move 0, still store it
  return timeline;
}

/**
 * Looks up the orientation index for a given move index in the timeline.
 *
 * @param timeline - Compact orientation timeline
 * @param moveIndex - Index into the moves array
 * @returns The orientation index (0-23), or 0 (identity) if not found
 */
export function getOrientationAtIndex(
  timeline: OrientationTimeline | undefined,
  moveIndex: number,
): number {
  if (!timeline || timeline.length === 0) return 0; // Identity

  // Find the keyframe whose moveIndex is <= the requested index
  let result = 0;
  for (const [mi, oi] of timeline) {
    if (mi <= moveIndex) {
      result = oi;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Reconstructs the per-move orientation snapshots from a compact keyframe
 * timeline.
 *
 * This is the inverse of {@link compactOrientationTimeline}: it expands the
 * sparse `[moveIndex, orientationIndex]` keyframes back into an array with
 * one `CubeOrientation` per move. Between keyframes the orientation is
 * assumed constant (that is the timeline's storage contract), and before the
 * first keyframe it is identity. Used to re-run the analysis pipeline on an
 * already-persisted solve whose raw per-move snapshots were only stored in
 * compact form.
 *
 * @param timeline - Compact orientation timeline from a persisted solve
 * @param moveCount - Length of the moves array to align against
 * @returns One orientation per move index (identity-filled before keyframe 0)
 */
export function expandOrientationTimeline(
  timeline: OrientationTimeline | undefined,
  moveCount: number,
): (CubeOrientation | undefined)[] {
  const orientations: (CubeOrientation | undefined)[] = new Array(moveCount).fill(undefined);
  if (!timeline || timeline.length === 0) return orientations;

  for (let i = 0; i < moveCount; i++) {
    const orientationId = getOrientationAtIndex(timeline, i);
    const entry = OrientationTable.ENTRIES[orientationId] ?? OrientationTable.IDENTITY;
    orientations[i] = {
      quaternion: {
        x: entry.quaternion.x,
        y: entry.quaternion.y,
        z: entry.quaternion.z,
        w: entry.quaternion.w,
      },
      faceMap: { ...entry.faceMap } as FacePermutation,
      label: entry.label,
    };
  }

  return orientations;
}
