import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { CubeModel } from '../core/CubeModel';
import { easeInOutQuad } from './Easing';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTaskConfig {
  axis: RotationAxis;
  layerValues: number[];
  angleInDegrees: number;
  durationMs: number;
  elapsedMs?: number;
  resolve?: () => void;
}

class PivotTask {
  public inUse = false;
  public pivot = new Group();
  
  public startQuat = new Quaternion();
  public endQuat = new Quaternion();
  public currentQuat = new Quaternion();
  public rotationAxisVec = new Vector3();
  public rotationOffset = new Quaternion();
  
  public config!: RotationTaskConfig;
  public startTime = 0;
}

export class RotationEngine {
  private model: CubeModel;
  private pool: PivotTask[] = [];

  constructor(model: CubeModel) {
    this.model = model;
    // Allocate 6 pivot tasks (one for each possible outer face to rotate simultaneously)
    for (let i = 0; i < 6; i++) {
      const task = new PivotTask();
      this.model.root.add(task.pivot);
      this.pool.push(task);
    }
  }

  private getTargetCubies(axis: RotationAxis, layerValues: number[]): Group[] {
    const cubies: Group[] = [];
    for (const val of layerValues) {
      cubies.push(...this.model.getCubiesByFace(axis, val));
    }
    return cubies;
  }

  public rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angleInDegrees: number,
    durationMs: number,
    elapsedMs?: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // 1. Collision detection: if any target piece is already rotating, force it to finish
      // We must loop until NO intersection is found because snapping a task changes the logical state,
      // which might change what the currentTargetCubies are.
      let collision = true;
      while (collision) {
        collision = false;
        const currentTargetCubies = this.getTargetCubies(axis, layerValues);
        
        for (const runningTask of this.pool) {
          if (!runningTask.inUse) continue;
          
          const runningCubies = this.getTargetCubies(runningTask.config.axis, runningTask.config.layerValues);
          const intersects = currentTargetCubies.some(c => runningCubies.includes(c));
          
          if (intersects) {
            this.snapTask(runningTask);
            collision = true;
            break; // Break the for-loop to re-evaluate targetCubies with the newly updated logical state
          }
        }
      }

      // Now that all collisions are resolved, we can safely get the definitive target cubies
      const targetCubies = this.getTargetCubies(axis, layerValues);

      // 2. Find a free slot in the pool
      let task = this.pool.find(t => !t.inUse);
      if (!task) {
        // Fallback extremely rare: if pool is full, snap the oldest
        const oldest = this.pool.reduce((prev, curr) => (prev.startTime < curr.startTime ? prev : curr));
        this.snapTask(oldest);
        task = oldest;
      }

      // 3. Configure the task
      task.inUse = true;
      task.config = { axis, layerValues, angleInDegrees, durationMs, elapsedMs, resolve };
      task.startTime = 0; // will be calculated in next update()

      this.preparePivot(task, targetCubies);
    });
  }

  private preparePivot(task: PivotTask, targetCubies: Group[]): void {
    task.pivot.quaternion.identity();
    task.pivot.updateMatrixWorld(true);

    for (const cubie of targetCubies) {
      task.pivot.add(cubie);
    }

    task.startQuat.copy(task.pivot.quaternion);

    task.rotationAxisVec.set(0, 0, 0);
    task.rotationAxisVec[task.config.axis] = 1;

    const angleRads = MathUtils.degToRad(task.config.angleInDegrees);
    task.rotationOffset.setFromAxisAngle(task.rotationAxisVec, angleRads);
    task.endQuat.copy(task.rotationOffset).multiply(task.startQuat);
  }

  public update(timeNowMs: number): void {
    for (const task of this.pool) {
      if (!task.inUse) continue;

      if (!task.startTime) {
        // Time-Warp (Dead Reckoning): 
        // If the event happened in the past (elapsedMs > 0), we offset the startTime
        // so the interpolation skips the frames "lost" to network latency.
        const offset = task.config.elapsedMs ?? 0;
        // Limit offset to durationMs so we don't overshoot 100% instantly on heavy lag
        const safeOffset = Math.min(offset, task.config.durationMs);
        task.startTime = timeNowMs - safeOffset;
      }

      const elapsed = timeNowMs - task.startTime;
      let t = elapsed / task.config.durationMs;

      // Mathematical protection
      if (task.config.durationMs <= 0) t = 1.0;

      if (t >= 1.0) {
        this.snapTask(task);
      } else {
        const easedT = easeInOutQuad(t);
        task.currentQuat.slerpQuaternions(task.startQuat, task.endQuat, easedT);
        task.pivot.quaternion.copy(task.currentQuat);
        task.pivot.updateMatrixWorld(true);
      }
    }
  }

  private snapTask(task: PivotTask): void {
    if (!task.inUse) return;

    const { axis, layerValues, angleInDegrees, resolve } = task.config;
    const children = [...task.pivot.children] as Group[]; // Shallow copy of children

    // 1. Snap to the mathematically exact final orientation
    task.pivot.quaternion.copy(task.endQuat);

    // 2. Apply local rotation to each cubie and reparent to root
    for (const child of children) {
      child.position.applyQuaternion(task.pivot.quaternion);
      child.quaternion.premultiply(task.pivot.quaternion);
      this.model.root.add(child);
    }

    // 3. Update logical integer-based state model
    const quarterTurns = Math.round(angleInDegrees / 90);
    for (const layerValue of layerValues) {
      this.model.updateLogicalState(axis, layerValue, quarterTurns);
    }

    // 4. Snap positions to logical grid (only for affected pieces!)
    this.model.snapCubiePositions(children);

    // 5. Reset pivot
    task.pivot.quaternion.identity();
    task.inUse = false;

    // 6. Resolve promise
    if (resolve) {
      resolve();
    }
  }
}
