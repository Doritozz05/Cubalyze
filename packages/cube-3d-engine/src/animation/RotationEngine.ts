import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { CubeModel } from '../core/CubeModel';
import { getEasing, type EasingStrategy } from './Easing';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationTaskConfig {
  axis: RotationAxis;
  layerValues: number[];
  angleInDegrees: number;
  durationMs: number;
  elapsedMs?: number;
  /** Easing strategy for this animation. Defaults to 'bounce'. */
  easingStrategy?: EasingStrategy;
  resolve?: () => void;
}

class PivotTask {
  public inUse = false;
  /**
   * 'animate' — a timed layer rotation (rotations, scrambles, keyboard).
   * 'live'    — a free-form twist whose angle is driven externally frame by
   *             frame (`setTwistAngle`); used by the drag-to-turn touch model
   *             so the layer follows the finger before snapping.
   */
  public mode: 'animate' | 'live' = 'animate';
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

  /**
   * Force-complete every in-flight pivot task immediately (snap to its exact
   * end state + logical update). After this, NO task is left animating, so a
   * following absolute-state operation (resetCube / applyFacelets / seek)
   * can never be overwritten by a stale animation's completion.
   *
   * Called by Cube3DEngine.resetCube / syncFacelets / flushAnimations and by
   * the replay transport before every reset. Without it, a rotation that was
   * still turning when the cube was reset snaps LATER and applies its rotation
   * — plus its logical-grid update — on top of the freshly reset state,
   * desyncing the model from the renderer (colors/positions corrupted).
   */
  public flushAll(): void {
    for (const task of this.pool) {
      if (task.inUse) this.snapTask(task);
    }
  }

  public rotateLayers(
    axis: RotationAxis,
    layerValues: number[],
    angleInDegrees: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: EasingStrategy
  ): Promise<void> {
    return new Promise((resolve) => {
      // NaN guard: a malformed move (e.g. a stored event with a bad/undefined
      // direction) would otherwise produce a NaN quaternion via
      // setFromAxisAngle → the cubie matrix becomes NaN and the mesh is culled
      // or rendered black (stickers disappearing / turning black). Reject the
      // move outright — a no-op is always safer than corrupting the model.
      if (!Number.isFinite(angleInDegrees)) {
        resolve();
        return;
      }
      const safeElapsed =
        typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0
          ? elapsedMs
          : 0;
      // A NaN/negative duration would yield t = elapsed/NaN = NaN (or a
      // negative t) in update() → NaN feeds slerpQuaternions → corrupted
      // cubie matrices. Clamp to 0 (instant snap) — the same NaN family as
      // the angle guard above.
      const safeDuration =
        typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
          ? durationMs
          : 0;

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
        // Fallback extremely rare: if pool is full, snap the oldest timed
        // task. NEVER a live twist (its startTime is 0, which would make it
        // the "oldest" — snapping it would silently cancel an active drag).
        const candidates = this.pool.filter((t) => t.mode !== 'live');
        const oldest = (candidates.length > 0 ? candidates : this.pool).reduce((prev, curr) =>
          prev.startTime <= curr.startTime ? prev : curr,
        );
        this.snapTask(oldest);
        task = oldest;
      }

      // 3. Configure the task
      task.inUse = true;
      task.mode = 'animate';
      task.config = { axis, layerValues, angleInDegrees, durationMs: safeDuration, elapsedMs: safeElapsed, easingStrategy, resolve };
      task.startTime = 0; // will be calculated in next update()

      this.preparePivot(task, targetCubies);
    });
  }

  /**
   * Start a free-form layer twist (drag-to-turn).
   *
   * Detaches the target layer onto its own pivot and hands the angle to the
   * caller via {@link setTwistAngle}, so the layer can follow the pointer in
   * real time. No logical state changes while twisting — the move only lands
   * when the twist is finished ({@link finishTwist} with a 90° target) or is
   * abandoned ({@link finishTwist} with 0 → spring back).
   *
   * Colliding timed rotations are snapped first (same invariant as
   * {@link rotateLayers}), so a keyboard move on the same layer can never
   * double-rotate on top of a live drag.
   *
   * @returns `false` when a live twist is already active or no pivot slot is
   *   free (the caller should fall back to orbit mode instead of fighting
   *   over the cubies).
   */
  public beginTwist(axis: RotationAxis, layerValues: number[]): boolean {
    if (this.pool.some((t) => t.inUse && t.mode === 'live')) return false;

    // 1. Snap any timed rotation that shares a piece with this layer.
    let collision = true;
    while (collision) {
      collision = false;
      const currentTargetCubies = this.getTargetCubies(axis, layerValues);
      for (const runningTask of this.pool) {
        if (!runningTask.inUse || runningTask.mode === 'live') continue;
        const runningCubies = this.getTargetCubies(runningTask.config.axis, runningTask.config.layerValues);
        if (currentTargetCubies.some((c) => runningCubies.includes(c))) {
          this.snapTask(runningTask);
          collision = true;
          break;
        }
      }
    }

    // 2. Claim a free pivot for the live drag.
    const targetCubies = this.getTargetCubies(axis, layerValues);
    const task = this.pool.find((t) => !t.inUse);
    if (!task) return false;

    task.inUse = true;
    task.mode = 'live';
    task.config = { axis, layerValues, angleInDegrees: 0, durationMs: 0 };
    task.startTime = 0;
    this.preparePivot(task, targetCubies);
    return true;
  }

  /**
   * Drive the active live twist to an absolute angle (degrees, engine
   * convention: positive = positive rotation around the task axis). No-op
   * when no live twist is active or the angle is not finite.
   */
  public setTwistAngle(angleInDegrees: number): void {
    const task = this.pool.find((t) => t.inUse && t.mode === 'live');
    if (!task) return;
    if (!Number.isFinite(angleInDegrees)) return;
    task.pivot.quaternion.setFromAxisAngle(
      task.rotationAxisVec,
      MathUtils.degToRad(angleInDegrees),
    );
    task.pivot.updateMatrixWorld(true);
  }

  /**
   * Finish the active live twist by animating from its current angle to
   * `targetAngleInDegrees` (0 = spring back, ±90 = commit a turn), then
   * applying the matching logical update (round(target / 90) quarter turns).
   * Resolves when the animation completes or immediately when no live twist
   * is active.
   */
  public finishTwist(targetAngleInDegrees: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const task = this.pool.find((t) => t.inUse && t.mode === 'live');
      if (!task) {
        resolve();
        return;
      }
      const safeTarget = Number.isFinite(targetAngleInDegrees) ? targetAngleInDegrees : 0;
      const safeDuration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;

      task.mode = 'animate';
      task.config = { ...task.config, angleInDegrees: safeTarget, durationMs: safeDuration, resolve };
      task.startQuat.copy(task.pivot.quaternion);
      task.rotationOffset.setFromAxisAngle(task.rotationAxisVec, MathUtils.degToRad(safeTarget));
      task.endQuat.copy(task.rotationOffset);
      task.startTime = 0; // will be calculated in next update()
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

  /**
   * True when at least one pivot task is still animating.
   * Lets the render loop know whether to keep rendering or pause (dirty-flag).
   */
  public isAnimating(): boolean {
    return this.pool.some((t) => t.inUse);
  }

  /** True while a free-form drag twist is active (before it commits/cancels). */
  public isLiveTwistActive(): boolean {
    return this.pool.some((t) => t.inUse && t.mode === 'live');
  }

  public update(timeNowMs: number): void {
    for (const task of this.pool) {
      if (!task.inUse) continue;
      // Live twists are driven externally via setTwistAngle — never advance
      // them with time-based interpolation.
      if (task.mode === 'live') continue;

      if (!task.startTime) {
        // Time-Warp (Dead Reckoning): 
        // If the event happened in the past (elapsedMs > 0), we offset the startTime
        // so the interpolation skips the frames "lost" to network latency.
        // (elapsedMs is sanitized in rotateLayers — a NaN offset would poison
        // startTime and produce a NaN interpolation.)
        const offset = task.config.elapsedMs ?? 0;
        // Limit offset to durationMs so we don't overshoot 100% instantly on heavy lag
        const safeOffset = Number.isFinite(offset) && offset > 0
          ? Math.min(offset, task.config.durationMs)
          : 0;
        task.startTime = timeNowMs - safeOffset;
      }

      // Defense-in-depth for any caller path that bypasses rotateLayers'
      // clamp: a NaN/≤0 duration must snap THIS frame (t = elapsed/NaN is
      // always NaN and would poison the slerp).
      if (!Number.isFinite(task.config.durationMs) || task.config.durationMs <= 0) {
        this.snapTask(task);
        continue;
      }

      const elapsed = timeNowMs - task.startTime;
      let t = elapsed / task.config.durationMs;

      // Mathematical protection
      if (task.config.durationMs <= 0) t = 1.0;

      if (t >= 1.0) {
        this.snapTask(task);
      } else {
        // Adaptive easing: use the strategy from config, fall back to bounce (easeOutBack)
        const strategy = task.config.easingStrategy ?? 'bounce';
        const easingFn = getEasing(strategy);
        const easedT = easingFn(t);
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
