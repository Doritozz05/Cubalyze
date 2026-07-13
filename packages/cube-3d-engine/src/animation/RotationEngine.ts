import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { CubeModel } from '../core/CubeModel';
import { easeInOutQuad } from './Easing';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTask {
  axis: RotationAxis;
  layerValues: number[];    // array of layers, e.g. [1], or [-1, 1]
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

  public rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
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
        layerValues,
        angleInDegrees,
        durationMs,
        resolve,
      };

      this.preparePivot(axis, layerValues, angleInDegrees);
    });
  }

  private preparePivot(axis: RotationAxis, layerValues: number[], angleInDegrees: number): void {
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld(true);

    for (const layerValue of layerValues) {
      const targetCubies = this.model.getCubiesByFace(axis, layerValue);
      for (const cubie of targetCubies) {
        // Como pivot y cubie comparten el mismo padre (root) y pivot está en identidad,
        // podemos usar add() en lugar de attach() sin alterar su transform global.
        this.pivot.add(cubie);
      }
    }

    this.startQuat.copy(this.pivot.quaternion);

    this.rotationAxisVec.set(0, 0, 0);
    this.rotationAxisVec[axis] = 1;

    const angleRads = MathUtils.degToRad(angleInDegrees);

    this.rotationOffset.setFromAxisAngle(this.rotationAxisVec, angleRads);
    this.endQuat.copy(this.rotationOffset).multiply(this.startQuat);
  }

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
      const easedT = easeInOutQuad(t);
      this.currentQuat.slerpQuaternions(this.startQuat, this.endQuat, easedT);
      this.pivot.quaternion.copy(this.currentQuat);
      this.pivot.updateMatrixWorld(true);
    }
  }

  /**
   * Immediately completes the active rotation animation.
   */
  private snapActiveTask(): void {
    if (!this.activeTask) return;

    const { axis, layerValues, angleInDegrees, resolve } = this.activeTask;

    // 1. Snap to the mathematically exact final orientation
    this.pivot.quaternion.copy(this.endQuat);

    // 2. Aplicar rotación localmente a cada cubie y reparentarlos al root.
    // Esto evita el uso costoso de attach() y elimina el drift de matriz global.
    while (this.pivot.children.length > 0) {
      const child = this.pivot.children[0];
      
      // Aplicar rotación del pivot a la posición y quaternion del hijo (espacio local)
      child.position.applyQuaternion(this.pivot.quaternion);
      child.quaternion.premultiply(this.pivot.quaternion);
      
      this.model.root.add(child);
    }

    // 3. Update the logical integer-based state model.
    const quarterTurns = Math.round(angleInDegrees / 90);
    for (const layerValue of layerValues) {
      this.model.updateLogicalState(axis, layerValue, quarterTurns);
    }

    // 4. CRITICAL FIX: Snap mesh positions to logical grid.
    this.model.snapCubiePositions();

    // 5. Reset pivot for next rotation
    this.pivot.quaternion.identity();

    // 6. Clear active task and resolve promise
    this.activeTask = null;
    if (resolve) {
      resolve();
    }
  }
}
