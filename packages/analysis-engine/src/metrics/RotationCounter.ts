import type { SolveTimeline, RotationMetrics } from '@cubeforge/types';

/**
 * Counts and analyzes cube rotations (x, y, z) from the solve timeline.
 *
 * Rotations are detected via two mechanisms:
 *   1. RotationEvents from the OrientationTracker (IMU-based, most accurate)
 *   2. Orientation changes between consecutive timeline entries (fallback)
 *
 * Metrics computed:
 *   - Total rotation count
 *   - Per-axis breakdown (x, y, z)
 *   - Estimated time lost to rotating
 *   - Consecutive rotations (potential regrips)
 *   - Rotations per phase
 *   - Rotation-to-move ratio (efficiency indicator)
 *   - Redundant rotations (immediate cancellations)
 */
export class RotationCounter {
  /** Estimated average time per rotation in ms (conservative). */
  static readonly AVG_ROTATION_TIME_MS = 300;

  /**
   * Compute rotation metrics from a solve timeline.
   *
   * Uses orientation data from timeline entries to detect rotations.
   *
   * @param timeline - The annotated SolveTimeline.
   * @returns RotationMetrics.
   */
  static compute(timeline: SolveTimeline): RotationMetrics {
    const { entries, phases } = timeline;

    if (entries.length === 0) {
      return {
        totalCount: 0,
        byAxis: { x: 0, y: 0, z: 0 },
        estimatedRotationTimeMs: 0,
        consecutiveCount: 0,
        byPhase: {},
        rotationToMoveRatio: 0,
        redundantRotations: 0,
      };
    }

    // Detect rotations by comparing orientation between consecutive entries
    const rotationEvents = RotationCounter.detectRotationsFromOrientations(entries);

    // Count by axis
    const byAxis = { x: 0, y: 0, z: 0 };
    for (const rot of rotationEvents) {
      byAxis[rot.axis]++;
    }

    const totalCount = rotationEvents.length;

    // Estimate time lost rotating
    const estimatedRotationTimeMs = totalCount * RotationCounter.AVG_ROTATION_TIME_MS;

    // Count consecutive rotations (no intervening move)
    let consecutiveCount = 0;
    for (let i = 0; i < rotationEvents.length - 1; i++) {
      const curr = rotationEvents[i];
      const next = rotationEvents[i + 1];

      // Check if the two rotations are between the same move indices
      // (meaning no face move occurred between them)
      if (next.startIndex === curr.endIndex) {
        consecutiveCount++;
      }
    }

    // Count redundant rotations (e.g., y followed by y')
    let redundantRotations = 0;
    for (let i = 0; i < rotationEvents.length - 1; i++) {
      const curr = rotationEvents[i];
      const next = rotationEvents[i + 1];

      if (
        curr.axis === next.axis &&
        curr.direction === -next.direction &&
        next.startIndex === curr.endIndex
      ) {
        redundantRotations++;
      }
    }

    // Rotations per phase
    const byPhase: Record<string, number> = {};
    for (const rot of rotationEvents) {
      const entry = entries[rot.startIndex];
      const phaseName = entry.phaseName || 'unknown';
      byPhase[phaseName] = (byPhase[phaseName] || 0) + 1;
    }

    // Initialize all phases to 0
    for (const phase of phases) {
      if (!(phase.phaseName in byPhase)) {
        byPhase[phase.phaseName] = 0;
      }
    }

    // Rotation-to-move ratio
    const rotationToMoveRatio = entries.length > 0
      ? Math.round((totalCount / entries.length) * 1000) / 1000
      : 0;

    return {
      totalCount,
      byAxis,
      estimatedRotationTimeMs,
      consecutiveCount,
      byPhase,
      rotationToMoveRatio,
      redundantRotations,
    };
  }

  /**
   * Detect rotations by comparing the cube orientation between
   * consecutive timeline entries.
   *
   * A rotation is detected when the orientation faceMap changes
   * between two entries, meaning the cube was physically rotated.
   *
   * @internal This is a fallback when RotationEvents are not available.
   * The OrientationTracker provides more accurate events via IMU.
   */
  static detectRotationsFromOrientations(
    entries: SolveTimeline['entries'],
  ): Array<{
    startIndex: number;
    endIndex: number;
    axis: 'x' | 'y' | 'z';
    direction: 1 | -1 | 2;
  }> {
    const rotations: Array<{
      startIndex: number;
      endIndex: number;
      axis: 'x' | 'y' | 'z';
      direction: 1 | -1 | 2;
    }> = [];

    for (let i = 0; i < entries.length - 1; i++) {
      const curr = entries[i];
      const next = entries[i + 1];

      // Check if orientation changed
      if (curr.orientation && next.orientation) {
        const currFM = curr.orientation.faceMap as Record<string, string>;
        const nextFM = next.orientation.faceMap as Record<string, string>;

        // Quick equality check using F, U, R face mapping
        if (
          currFM.F !== nextFM.F ||
          currFM.U !== nextFM.U ||
          currFM.R !== nextFM.R
        ) {
          // Orientation changed — detect the rotation axis and direction
          const rot = RotationCounter.classifyRotation(currFM, nextFM);
          if (rot) {
            rotations.push({
              startIndex: i,
              endIndex: i + 1,
              axis: rot.axis,
              direction: rot.direction,
            });
          }
        }
      }
    }

    return rotations;
  }

  /**
   * Classify a rotation between two orientations.
   *
   * Simplified classification based on faceMap changes:
   * - If F↔U cycle changes: x rotation
   * - If F↔R cycle changes: y rotation
   * - If U↔R cycle changes: z rotation
   *
   * Direction is approximated (1 = CW, -1 = CCW, 2 uncertain).
   */
  static classifyRotation(
    from: Record<string, string>,
    to: Record<string, string>,
  ): { axis: 'x' | 'y' | 'z'; direction: 1 | -1 | 2 } | null {
    // x rotation: F→U→B→D→F cycle, L and R stay
    if (from.R === to.R && from.L === to.L) {
      // Determine direction by checking if F moved to U (x) or D (x')
      if (from.F === to.U) return { axis: 'x', direction: -1 }; // x = F→U
      if (from.F === to.D) return { axis: 'x', direction: 1 };  // x' = F→D
      if (from.B === to.U) return { axis: 'x', direction: 1 };
      if (from.B === to.D) return { axis: 'x', direction: -1 };
      // x2: U↔D, F↔B
      if (from.U === to.D && from.F === to.B) return { axis: 'x', direction: 2 };
    }

    // y rotation: F→R→B→L→F cycle, U and D stay
    if (from.U === to.U && from.D === to.D) {
      if (from.F === to.R) return { axis: 'y', direction: -1 }; // y
      if (from.F === to.L) return { axis: 'y', direction: 1 };  // y'
      if (from.F === to.B && from.R === to.L) return { axis: 'y', direction: 2 };
    }

    // z rotation: U→R→D→L→U cycle, F and B stay
    if (from.F === to.F && from.B === to.B) {
      if (from.U === to.R) return { axis: 'z', direction: -1 }; // z
      if (from.U === to.L) return { axis: 'z', direction: 1 };  // z'
      if (from.U === to.D && from.R === to.L) return { axis: 'z', direction: 2 };
    }

    // Unable to classify
    return null;
  }
}
