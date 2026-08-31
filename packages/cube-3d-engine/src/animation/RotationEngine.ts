import { Group, Vector3 } from 'three';
import { CubeModel } from '../core/CubeModel';
import {
  RotationDriver3D,
  type RotationHooks3D,
  type SliceRef3D,
} from './RotationDriver3D';
import type { EasingStrategy } from './Easing';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTaskConfig {
  axis: RotationAxis;
  layerValues: number[];
  angleInDegrees: number;
  durationMs: number;
  elapsedMs?: number;
  easingStrategy?: EasingStrategy;
  resolve?: () => void;
}

/** The cube's slice identifier: an axis + the layer values turning together. */
interface CubeSliceRef extends SliceRef3D {
  id: { axis: RotationAxis; layerValues: number[] };
}

/** Shared unit vectors — the cube only ever rotates around x/y/z. */
const AXIS_VECTORS: Record<RotationAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

/**
 * Cube adapter over the generic {@link RotationDriver3D}.
 *
 * All pivot/animation/collision machinery lives in the generic driver; this
 * class supplies only the cube-specific hooks:
 *   • slice pieces  → `CubeModel.getCubiesByFace(axis, layerValue)`
 *   • logical state → `CubeModel.updateLogicalState` (integer grid permutation)
 *   • snap          → `CubeModel.snapCubiePositions` (grid-immune to drift)
 *
 * Public API and behavior are byte-for-byte the previous standalone engine —
 * `RotationDriver3D` is a faithful port of its internals.
 */
export class RotationEngine {
  private model: CubeModel;
  private driver: RotationDriver3D<CubeSliceRef>;

  constructor(model: CubeModel) {
    this.model = model;
    const hooks: RotationHooks3D<CubeSliceRef> = {
      getSlicePieces: (slice) => this.getSlicePieces(slice),
      commitSlice: (slice, angleInDegrees) => this.commitSlice(slice, angleInDegrees),
      snapPieces: (pieces) => this.model.snapCubiePositions(pieces),
    };
    this.driver = new RotationDriver3D<CubeSliceRef>(model.root, hooks);
  }

  private sliceRef(axis: RotationAxis, layerValues: number[]): CubeSliceRef {
    return { id: { axis, layerValues }, axis: AXIS_VECTORS[axis] };
  }

  private getSlicePieces(slice: CubeSliceRef): Group[] {
    const { axis, layerValues } = slice.id;
    const pieces: Group[] = [];
    for (const val of layerValues) {
      pieces.push(...this.model.getCubiesByFace(axis, val));
    }
    return pieces;
  }

  private commitSlice(slice: CubeSliceRef, angleInDegrees: number): void {
    const { axis, layerValues } = slice.id;
    const quarterTurns = Math.round(angleInDegrees / 90);
    for (const layerValue of layerValues) {
      this.model.updateLogicalState(axis, layerValue, quarterTurns);
    }
  }

  /**
   * Force-complete every in-flight pivot task immediately (snap to its exact
   * end state + logical update). After this, NO task is left animating, so a
   * following absolute-state operation (resetCube / applyFacelets / seek)
   * can never be overwritten by a stale animation's completion.
   */
  public flushAll(): void {
    this.driver.flushAll();
  }

  public rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angleInDegrees: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: EasingStrategy,
  ): Promise<void> {
    return this.driver.rotate(
      this.sliceRef(axis, layerValues),
      angleInDegrees,
      durationMs,
      elapsedMs,
      easingStrategy,
    );
  }

  /**
   * Start a free-form layer twist (drag-to-turn). See {@link RotationDriver3D.beginTwist}.
   * @returns `false` when a twist is already active or no pivot is free.
   */
  public beginTwist(axis: RotationAxis, layerValues: number[]): boolean {
    return this.driver.beginTwist(this.sliceRef(axis, layerValues));
  }

  /** Drive the active layer twist to an absolute angle (degrees). */
  public setTwistAngle(angleInDegrees: number): void {
    this.driver.setTwistAngle(angleInDegrees);
  }

  /**
   * Commit the active layer twist: animate from its current angle to
   * `targetAngleDegrees` (±90 = complete turn, 0 = spring back) and apply
   * the matching logical update. Resolves when the animation completes.
   */
  public finishTwist(targetAngleInDegrees: number, durationMs: number): Promise<void> {
    return this.driver.finishTwist(targetAngleInDegrees, durationMs);
  }

  /** True when at least one pivot task is still animating. */
  public isAnimating(): boolean {
    return this.driver.isAnimating();
  }

  /** True while a free-form drag twist is active (before it commits/cancels). */
  public isLiveTwistActive(): boolean {
    return this.driver.isLiveTwistActive();
  }

  public update(timeNowMs: number): void {
    this.driver.update(timeNowMs);
  }
}
