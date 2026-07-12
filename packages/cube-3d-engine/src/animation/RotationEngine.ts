import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { CubeModel } from '../core/CubeModel';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTask {
  axis: RotationAxis;
  layerValue: number; // 1, 0, -1
  angleInDegrees: number; // e.g. 90, -90, 180
  durationMs: number;
  startTime?: number;
  resolve?: () => void;
}

export class RotationEngine {
  private model: CubeModel;
  private pivot: Group;
  private activeTask: RotationTask | null = null;

  // Pre-allocated math objects to avoid GC during animation loop
  private startQuat = new Quaternion();
  private endQuat = new Quaternion();
  private currentQuat = new Quaternion();
  private rotationAxisVec = new Vector3();

  constructor(model: CubeModel) {
    this.model = model;
    this.pivot = new Group();
    this.model.root.add(this.pivot);
  }

  public rotateLayer(axis: RotationAxis, layerValue: number, angleInDegrees: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      // If there's an active animation, instantly snap it to end so we don't drop moves
      if (this.activeTask) {
        this.snapActiveTask();
      }

      this.activeTask = {
        axis,
        layerValue,
        angleInDegrees,
        durationMs,
        resolve
      };

      this.preparePivot(axis, layerValue, angleInDegrees);
    });
  }

  private preparePivot(axis: RotationAxis, layerValue: number, angleInDegrees: number): void {
    // Ensure pivot is clean
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();

    // Get cubies and attach them to pivot
    const targetCubies = this.model.getCubiesByFace(axis, layerValue);
    for (const cubie of targetCubies) {
      this.pivot.attach(cubie); // attaches maintaining world transform
    }

    // Set up math quaternions
    this.startQuat.copy(this.pivot.quaternion);
    
    this.rotationAxisVec.set(0, 0, 0);
    this.rotationAxisVec[axis] = 1;

    const angleRads = MathUtils.degToRad(angleInDegrees);
    const rotationOffset = new Quaternion().setFromAxisAngle(this.rotationAxisVec, angleRads);
    this.endQuat.copy(this.startQuat).multiply(rotationOffset);
  }

  public update(timeNowMs: number): void {
    if (!this.activeTask) return;

    if (!this.activeTask.startTime) {
      this.activeTask.startTime = timeNowMs;
    }

    let progress = (timeNowMs - this.activeTask.startTime) / this.activeTask.durationMs;
    
    if (progress >= 1.0) {
      this.snapActiveTask();
    } else {
      // Standard EaseInOut Quadratic interpolation
      progress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      this.currentQuat.slerpQuaternions(this.startQuat, this.endQuat, progress);
      this.pivot.quaternion.copy(this.currentQuat);
      this.pivot.updateMatrixWorld();
    }
  }

  private snapActiveTask(): void {
    if (!this.activeTask) return;

    // Snap to end quaternion
    this.pivot.quaternion.copy(this.endQuat);
    this.pivot.updateMatrixWorld();

    // Detach children back to root
    while (this.pivot.children.length > 0) {
      this.model.root.attach(this.pivot.children[0]);
    }

    // Resolve promise
    if (this.activeTask.resolve) {
      this.activeTask.resolve();
    }
    
    this.activeTask = null;
  }
}
