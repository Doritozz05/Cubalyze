import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { CubeModel } from '../core/CubeModel';
import { easeInOutQuad } from './Easing';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTask {
  axis: RotationAxis;
  layerValue: number;       // 1, 0, -1
  angleInDegrees: number;   // e.g. 90, -90, 180
  durationMs: number;
  startTime?: number;
  resolve?: () => void;
}

export class RotationEngine {
  private model: CubeModel;
  private pivot: Group;
  private activeTask: RotationTask | null = null;

  // ── Pre-allocated math objects (GC mitigation per TDD-0006 / ADR-014) ──
  // These are mutated in-place during the animation loop. No allocations inside
  // update() or preparePivot() to avoid triggering garbage collection during
  // 60fps rendering.
  private startQuat = new Quaternion();
  private endQuat = new Quaternion();
  private currentQuat = new Quaternion();
  private rotationAxisVec = new Vector3();
  private rotationOffset = new Quaternion(); // FIX: pre-allocate instead of `new` inside preparePivot

  constructor(model: CubeModel) {
    this.model = model;
    this.pivot = new Group();
    this.model.root.add(this.pivot);
  }

  public rotateLayer(
    axis: RotationAxis,
    layerValue: number,
    angleInDegrees: number,
    durationMs: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // If there's an active animation, instantly snap it to end so we don't drop moves.
      // This matches the TDD-0006 spec: "zero input-lag perception" for fast hardware events.
      if (this.activeTask) {
        this.snapActiveTask();
      }

      this.activeTask = {
        axis,
        layerValue,
        angleInDegrees,
        durationMs,
        resolve,
      };

      this.preparePivot(axis, layerValue, angleInDegrees);
    });
  }

  private preparePivot(axis: RotationAxis, layerValue: number, angleInDegrees: number): void {
    // ── FIX: Reset pivot to identity using quaternion directly ──
    // Using .rotation.set(0,0,0) sets Euler angles which then get lazily
    // converted to a quaternion. But if the quaternion was previously set
    // directly (as we do during animation), Three.js's internal Euler↔Quaternion
    // sync can be unreliable. Explicitly resetting the quaternion is bulletproof.
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld(true);

    // Get cubies for this layer and attach them to the pivot.
    // Object3D.attach() preserves world transform when reparenting.
    const targetCubies = this.model.getCubiesByFace(axis, layerValue);
    for (const cubie of targetCubies) {
      this.pivot.attach(cubie);
    }

    // ── Set up quaternion interpolation targets ──
    this.startQuat.copy(this.pivot.quaternion); // identity after reset

    this.rotationAxisVec.set(0, 0, 0);
    this.rotationAxisVec[axis] = 1;

    const angleRads = MathUtils.degToRad(angleInDegrees);

    // ── FIX: Use pre-allocated rotationOffset (no `new` inside hot path) ──
    this.rotationOffset.setFromAxisAngle(this.rotationAxisVec, angleRads);

    // ── FIX: Correct quaternion multiplication order ──
    // For a rotation in WORLD space, the formula is:
    //   Q_final = Q_rotation * Q_current
    //
    // Using Q_current * Q_rotation would apply the rotation in LOCAL space
    // of the pivot — which would be wrong if the pivot ever had a non-identity
    // starting orientation.
    //
    // Since we always reset pivot to identity, both orders produce the same
    // result. But using the correct world-space order is mathematically
    // correct and defensive against future changes.
    this.endQuat.copy(this.rotationOffset).multiply(this.startQuat);
  }

  /**
   * Called every frame from the render loop.
   * Advances the active rotation animation based on elapsed time.
   */
  public update(timeNowMs: number): void {
    if (!this.activeTask) return;

    if (!this.activeTask.startTime) {
      this.activeTask.startTime = timeNowMs;
    }

    const elapsed = timeNowMs - this.activeTask.startTime;
    let t = elapsed / this.activeTask.durationMs;

    if (t >= 1.0) {
      this.snapActiveTask();
    } else {
      // Apply easing from the dedicated Easing module (TDD-0006 compliance)
      const easedT = easeInOutQuad(t);
      this.currentQuat.slerpQuaternions(this.startQuat, this.endQuat, easedT);
      this.pivot.quaternion.copy(this.currentQuat);
      this.pivot.updateMatrixWorld(true);
    }
  }

  /**
   * Immediately completes the active rotation animation.
   *
   * This is the most critical method in the engine. The sequence is:
   * 1. Snap the pivot to the exact final quaternion
   * 2. Detach all cubies from the pivot back to the root (preserving world transform)
   * 3. Snap all cubie positions to integer grid (prevent floating-point drift)
   * 4. Update the logical state model (integer permutation — zero float risk)
   * 5. Reset the pivot
   * 6. Resolve the promise
   */
  private snapActiveTask(): void {
    if (!this.activeTask) return;

    const { axis, layerValue, angleInDegrees, resolve } = this.activeTask;

    // 1. Snap to the mathematically exact final orientation
    this.pivot.quaternion.copy(this.endQuat);
    this.pivot.updateMatrixWorld(true);

    // 2. Detach children back to the root group.
    //    Object3D.attach() preserves world transform, which is what introduces
    //    the floating-point error that this engine is designed to compensate for.
    while (this.pivot.children.length > 0) {
      this.model.root.attach(this.pivot.children[0]);
    }

    // 3. CRITICAL FIX: Snap mesh positions to nearest integer.
    //    Without this, positions drift (e.g. 0.99998 instead of 1.0) and
    //    getCubiesByFace() can no longer find cubies — causing the
    //    "disappearing layer" bug.
    this.model.snapCubiePositions();

    // 4. Update the logical integer-based state model.
    //    This is independent of the scene graph and cannot be corrupted by
    //    floating-point errors. quarterTurns = angle / 90 (handles 90, -90, 180).
    const quarterTurns = Math.round(angleInDegrees / 90);
    this.model.updateLogicalState(axis, layerValue, quarterTurns);

    // 5. Reset pivot for next rotation
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld(true);

    // 6. Clear active task and resolve promise
    this.activeTask = null;
    if (resolve) {
      resolve();
    }
  }
}
