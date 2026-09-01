import { Group, Quaternion, Vector3, MathUtils } from 'three';
import { getEasing, type EasingStrategy } from './Easing';

/**
 * A slice of a puzzle: the pieces that turn together plus the rotation axis.
 * Family-specific — the cube uses axis + layer values as its `id` and the
 * x/y/z unit vectors; a pyraminx will use a vertex axis vector and its own id.
 */
export interface SliceRef3D {
  /** Family-specific identifier, consumed by `commitSlice`. */
  readonly id: unknown;
  /** Unit rotation axis in the root frame. */
  readonly axis: Vector3;
}

/**
 * The three family-specific hooks the generic pivot machinery needs.
 * Everything else (collision detection, pivot pool, easing, live twist) is
 * puzzle-agnostic and lives in {@link RotationDriver3D}.
 */
export interface RotationHooks3D<S extends SliceRef3D = SliceRef3D> {
  /** Resolve a slice to the pieces that turn together (collision + pivot). */
  getSlicePieces(slice: S): Group[];
  /**
   * Apply the family's logical-state update after a committed turn
   * (e.g. the cube's integer grid permutation; a pyraminx would permute its
   * PyraminxState coordinates). Called BEFORE `snapPieces`.
   */
  commitSlice(slice: S, angleInDegrees: number, pieces: Group[]): void;
  /**
   * Optional: snap piece transforms onto the logical state (e.g. the cube's
   * integer grid, immune to float drift). Called AFTER `commitSlice`.
   */
  snapPieces?(pieces: Group[]): void;
}

export interface RotationTaskConfig3D<S extends SliceRef3D = SliceRef3D> {
  slice: S;
  angleInDegrees: number;
  durationMs: number;
  elapsedMs?: number;
  easingStrategy?: EasingStrategy;
  resolve?: () => void;
}

class PivotTask3D<S extends SliceRef3D = SliceRef3D> {
  public inUse = false;
  /**
   * 'animate' — a timed rotation (scrambles, keyboard, hardware).
   * 'live'    — a free-form twist whose angle is driven externally frame by
   *             frame (`setTwistAngle`); used by drag-to-turn.
   */
  public mode: 'animate' | 'live' = 'animate';
  public pivot = new Group();

  public startQuat = new Quaternion();
  public endQuat = new Quaternion();
  public currentQuat = new Quaternion();
  public rotationAxisVec = new Vector3();
  public rotationOffset = new Quaternion();

  public config!: RotationTaskConfig3D<S>;
  public startTime = 0;
}

/**
 * Generic pivot-based rotation machinery — the shared heart of every puzzle
 * family's turning animation:
 *
 *   1. Collision detection: if any target piece is already rotating, it is
 *      snapped to completion first (never double-rotated by one gesture).
 *   2. The slice's pieces are reparented onto a pooled pivot Group.
 *   3. The pivot animates around the slice's axis via quaternions (no gimbal
 *      lock) with the requested easing.
 *   4. On completion the rotation is baked into each piece, the pieces return
 *      to the root, and the family's `commitSlice` + `snapPieces` hooks run.
 *
 * This class contains NO cube logic: the NxN family adapts it through
 * `RotationEngine` (axis + layer values), and future families (pyraminx,
 * skewb, …) plug their own slice refs and hooks.
 */
export class RotationDriver3D<S extends SliceRef3D = SliceRef3D> {
  private root: Group;
  private hooks: RotationHooks3D<S>;
  private pool: PivotTask3D<S>[] = [];

  constructor(root: Group, hooks: RotationHooks3D<S>) {
    this.root = root;
    this.hooks = hooks;
    // Allocate 6 pivot tasks (one per simultaneous slice, like the cube's 6 faces).
    for (let i = 0; i < 6; i++) {
      const task = new PivotTask3D<S>();
      this.root.add(task.pivot);
      this.pool.push(task);
    }
  }

  /**
   * Force-complete every in-flight pivot task immediately (snap to its exact
   * end state + logical update). After this, NO task is left animating, so a
   * following absolute-state operation (reset / sync / seek) can never be
   * overwritten by a stale animation's completion.
   */
  public flushAll(): void {
    for (const task of this.pool) {
      if (task.inUse) this.snapTask(task);
    }
  }

  /** Animate one slice by `angleInDegrees`. Resolves when the turn lands. */
  public rotate(
    slice: S,
    angleInDegrees: number,
    durationMs: number,
    elapsedMs?: number,
    easingStrategy?: EasingStrategy,
  ): Promise<void> {
    return new Promise((resolve) => {
      // NaN guard: a malformed angle would produce a NaN quaternion → the
      // pieces' matrices become NaN and meshes render black/disappear.
      // Reject the move outright — a no-op is safer than corrupting the model.
      if (!Number.isFinite(angleInDegrees)) {
        resolve();
        return;
      }
      const safeElapsed =
        typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0
          ? elapsedMs
          : 0;
      const safeDuration =
        typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
          ? durationMs
          : 0;

      // 1. Collision detection: if any target piece is already rotating, force
      // it to finish. Loop until NO intersection remains, because snapping a
      // task changes the logical state, which can change the slice's pieces.
      let collision = true;
      while (collision) {
        collision = false;
        const currentTargetPieces = this.hooks.getSlicePieces(slice);

        for (const runningTask of this.pool) {
          if (!runningTask.inUse) continue;

          const runningPieces = this.hooks.getSlicePieces(runningTask.config.slice);
          const intersects = currentTargetPieces.some((p) => runningPieces.includes(p));

          if (intersects) {
            this.snapTask(runningTask);
            collision = true;
            break; // re-evaluate the target pieces with the updated logical state
          }
        }
      }

      // Now that collisions are resolved, get the definitive target pieces.
      const targetPieces = this.hooks.getSlicePieces(slice);

      // 2. Find a free slot in the pool.
      let task = this.pool.find((t) => !t.inUse);
      if (!task) {
        // Extremely rare fallback: pool full — snap the oldest TIMED task.
        // NEVER a live twist (startTime 0 would make it the "oldest" and
        // snapping it would silently cancel an active drag).
        const candidates = this.pool.filter((t) => t.mode !== 'live');
        const oldest = (candidates.length > 0 ? candidates : this.pool).reduce((prev, curr) =>
          prev.startTime <= curr.startTime ? prev : curr,
        );
        this.snapTask(oldest);
        task = oldest;
      }

      // 3. Configure the task.
      task.inUse = true;
      task.mode = 'animate';
      task.config = {
        slice,
        angleInDegrees,
        durationMs: safeDuration,
        elapsedMs: safeElapsed,
        easingStrategy,
        resolve,
      };
      task.startTime = 0; // calculated in the next update()

      this.preparePivot(task, targetPieces);
    });
  }

  /**
   * Start a free-form slice twist (drag-to-turn). Detaches the slice onto its
   * own pivot and hands the angle to the caller via {@link setTwistAngle}, so
   * the slice follows the pointer in real time. No logical state changes while
   * twisting — the move only lands on {@link finishTwist} (or springs back).
   *
   * @returns `false` when a twist is already active or no pivot slot is free.
   */
  public beginTwist(slice: S): boolean {
    if (this.pool.some((t) => t.inUse && t.mode === 'live')) return false;

    // Snap any timed rotation that shares a piece with this slice.
    let collision = true;
    while (collision) {
      collision = false;
      const currentTargetPieces = this.hooks.getSlicePieces(slice);
      for (const runningTask of this.pool) {
        if (!runningTask.inUse || runningTask.mode === 'live') continue;
        const runningPieces = this.hooks.getSlicePieces(runningTask.config.slice);
        if (currentTargetPieces.some((p) => runningPieces.includes(p))) {
          this.snapTask(runningTask);
          collision = true;
          break;
        }
      }
    }

    const targetPieces = this.hooks.getSlicePieces(slice);
    const task = this.pool.find((t) => !t.inUse);
    if (!task) return false;

    task.inUse = true;
    task.mode = 'live';
    task.config = { slice, angleInDegrees: 0, durationMs: 0 };
    task.startTime = 0;
    this.preparePivot(task, targetPieces);
    return true;
  }

  /** Drive the active live twist to an absolute angle (degrees, around the slice's axis). */
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
   * Finish the active live twist: animate from its current angle to
   * `targetAngleInDegrees` (0 = spring back, ±turn = commit) and apply the
   * matching logical update. Resolves when the animation completes.
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
      task.startTime = 0; // calculated in the next update()
    });
  }

  /** True when at least one pivot task is still animating. */
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
        // Time-Warp (Dead Reckoning): if the event happened in the past
        // (elapsedMs > 0), offset the startTime so the interpolation skips the
        // frames "lost" to network latency.
        const offset = task.config.elapsedMs ?? 0;
        const safeOffset = Number.isFinite(offset) && offset > 0
          ? Math.min(offset, task.config.durationMs)
          : 0;
        task.startTime = timeNowMs - safeOffset;
      }

      // Defense-in-depth for callers that bypass rotate()'s clamp: a
      // NaN/≤0 duration must snap THIS frame (t = elapsed/NaN is always NaN).
      if (!Number.isFinite(task.config.durationMs) || task.config.durationMs <= 0) {
        this.snapTask(task);
        continue;
      }

      const elapsed = timeNowMs - task.startTime;
      let t = elapsed / task.config.durationMs;

      if (task.config.durationMs <= 0) t = 1.0;

      if (t >= 1.0) {
        this.snapTask(task);
      } else {
        const strategy = task.config.easingStrategy ?? 'bounce';
        const easingFn = getEasing(strategy);
        const easedT = easingFn(t);
        task.currentQuat.slerpQuaternions(task.startQuat, task.endQuat, easedT);
        task.pivot.quaternion.copy(task.currentQuat);
        task.pivot.updateMatrixWorld(true);
      }
    }
  }

  private preparePivot(task: PivotTask3D<S>, targetPieces: Group[]): void {
    task.pivot.quaternion.identity();
    task.pivot.updateMatrixWorld(true);

    for (const piece of targetPieces) {
      task.pivot.add(piece);
    }

    task.startQuat.copy(task.pivot.quaternion);

    task.rotationAxisVec.copy(task.config.slice.axis);

    const angleRads = MathUtils.degToRad(task.config.angleInDegrees);
    task.rotationOffset.setFromAxisAngle(task.rotationAxisVec, angleRads);
    task.endQuat.copy(task.rotationOffset).multiply(task.startQuat);
  }

  private snapTask(task: PivotTask3D<S>): void {
    if (!task.inUse) return;

    const { slice, angleInDegrees, resolve } = task.config;
    const children = [...task.pivot.children] as Group[]; // shallow copy

    // 1. Snap to the mathematically exact final orientation.
    task.pivot.quaternion.copy(task.endQuat);

    // 2. Bake the rotation into each piece and reparent to the root.
    for (const child of children) {
      child.position.applyQuaternion(task.pivot.quaternion);
      child.quaternion.premultiply(task.pivot.quaternion);
      this.root.add(child);
    }

    // 3. Update the family's logical state (commit BEFORE snap — the snap
    //    positions derive from the freshly permuted logical coordinates).
    this.hooks.commitSlice(slice, angleInDegrees, children);
    this.hooks.snapPieces?.(children);

    // 4. Reset the pivot.
    task.pivot.quaternion.identity();
    task.inUse = false;

    // 5. Resolve the promise.
    resolve?.();
  }
}
