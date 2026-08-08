/**
 * @cubeforge/cube-3d-engine — Replay Engine
 *
 * A framework-agnostic engine that replays a sequence of CubeMoveEvents
 * with configurable speed, play/pause, and seek controls.
 *
 * Designed to work with any renderer: the caller provides callbacks for
 * resetting the cube and applying individual rotations.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   const engine = new ReplayEngine(moves, {
 *     resetCube: () => workerProxy.resetCube(),
 *     rotateLayers: (axis, layers, angle, dur, elapsed) =>
 *       workerProxy.rotateLayers(axis, layers, angle, dur, elapsed),
 *   });
 *
 *   engine.onPosition = (ms, idx) => updatePlayhead(ms);
 *   engine.onComplete = () => setReplayDone(true);
 *
 *   engine.setSpeed(0.5);
 *   engine.play();
 *   // ...
 *   engine.pause();
 *   engine.seek(4000); // ms from start
 *   engine.play();
 *   engine.stop();
 */

import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import type { CubeFace, CubeMoveEvent, RotationAxis, OrientationTimeline } from '@cubeforge/types';

// ─── Types ─────────────────────────────────────────────────────────────────

/** How to rotate a single layer for one move. */
export interface RotationParams {
  axis: RotationAxis;
  layerValues: number[];
  angle: number;
  /** When this move plays relative to replay start (ms, move-driven). */
  offsetMs: number;
  /** The original move's hostTimestamp (kept for reference/back-compat; the
   *  replay timeline no longer depends on it). */
  hostTimestamp: number;
}

/** Callbacks the renderer must provide. */
export interface ReplayCallbacks {
  resetCube: () => void | Promise<void>;
  rotateLayers: (
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
  ) => void | Promise<void>;
  /** Called when orientation changes. orientationIndex is 0-23 (OrientationTable.ENTRIES).
   *  Pass animationDurationMs > 0 for smooth SLERP, 0 for instant snap (seeking). */
  setOrientation?: (orientationIndex: number, animationDurationMs: number) => void | Promise<void>;
}

/** Playback states. */
export type ReplayState = 'idle' | 'playing' | 'paused' | 'seeking' | 'complete';

// ─── ReplayEngine ──────────────────────────────────────────────────────────

export class ReplayEngine {
  /** The list of moves with pre-computed rotation params. */
  private rotations: RotationParams[] = [];
  /** Pre-computed scramble rotations (applied before solve moves in seek). */
  private scrambleRotations: RotationParams[] = [];
  /** Total solve duration in ms (last move offset - first move offset). */
  private _totalMs = 0;

  /** Current playback speed multiplier. */
  private _speed = 1;

  /** Whether we're currently playing. */
  private _state: ReplayState = 'idle';

  /** The index of the *next* move to apply (0 = none applied yet). */
  private nextIndex = 0;

  /**
   * Virtual clock position in ms (relative to solve start).
   * This is where we ARE in the solve timeline, regardless of real wall-clock
   * time. Used for seek/pause.
   */
  private _positionMs = 0;

  /**
   * Wall-clock timestamp (performance.now()) when playback started or
   * was last resumed from pause.
   */
  private playStartWall = 0;

  /**
   * The virtual position we were at when we last started/resumed playing.
   * current position = this value + (wallClockNow - playStartWall) * speed
   */
  private resumePositionMs = 0;

  /** rAF handle. */
  private rafId: number | null = null;

  /** Callbacks supplied by user. */
  private callbacks: ReplayCallbacks;

  // ── Events ──────────────────────────────────────────────────────────────

  /** Fired every animation frame with the current position. */
  public onPosition: ((positionMs: number, moveIndex: number) => void) | null = null;

  /** Fired when the replay reaches the end. */
  public onComplete: (() => void) | null = null;

  /** Fired whenever a new move is applied (for move-by-move feedback). */
  public onMove: ((moveIndex: number, totalMoves: number) => void) | null = null;

  /** Fired on state change. */
  public onStateChange: ((state: ReplayState) => void) | null = null;

  /** Duration per move animation (ms). Shorter = snappier. */
  public moveAnimationDurationMs = 80;

  /**
   * Milliseconds allocated to each move on the replay timeline.
   *
   * Playback is MOVE-DRIVEN: the timeline length is `moves.length * this`
   * (never capped by the solve's real time), so EVERY move always plays
   * back — a 3s / 50-move record replays all 50 moves instead of being
   * cut off after a few. Change before calling setMoves() to alter pace.
   */
  public moveSpacingMs = 500;

  /** Compact orientation timeline for gyro replay (if IMU was available). */
  private orientationTimeline: OrientationTimeline | undefined;
  private lastAppliedOrientation = -1;

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor(
    moves: CubeMoveEvent[],
    callbacks: ReplayCallbacks,
    totalMs?: number,
    orientationTimeline?: OrientationTimeline,
  ) {
    this.callbacks = callbacks;
    this.orientationTimeline = orientationTimeline;
    this.setMoves(moves, totalMs);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Replace the move sequence (stops playback).
   *
   * The timeline is MOVE-DRIVEN: each move gets its own fixed slot
   * (`moveSpacingMs`) regardless of how fast/slow the solve actually was,
   * and the total length is `moves.length * moveSpacingMs`. hostTimestamp
   * deltas are intentionally ignored — on smart cubes and imported
   * reconstructions they can be bunched, zeroed, or skewed, which used to
   * cut replays short (e.g. only ~5 of 50 moves played for a 3s record).
   *
   * `totalMsOverride` (the old timer-time) is kept as a minimum floor:
   * it can only EXTEND the timeline, never cap it below the move-driven
   * duration.
   */
  public setMoves(moves: CubeMoveEvent[], totalMsOverride?: number): void {
    this.stop();

    this.rotations = moves.map((m, i) => {
      const mapping = FACE_ROTATION_MAP[m.face as CubeFace];
      const angle = m.direction * (mapping?.angleSign ?? 1) * 90;
      return {
        axis: (mapping?.axis ?? 'y') as RotationAxis,
        // A WIDE move rotates the outer layer AND the middle layer TOGETHER
        // in one animation (layerValue 0 = the middle slice). The angle sign
        // of the outer face is always the correct sign for the adjacent
        // middle layer too (r = R M', u = U E', f = F S — verified against
        // MoveExpander), so one shared angle drives both layers.
        layerValues: m.wide
          ? [mapping?.layerValue ?? 0, 0]
          : [mapping?.layerValue ?? 0],
        angle,
        offsetMs: i * this.moveSpacingMs,
        hostTimestamp: m.hostTimestamp,
      };
    });

    // Timeline must ALWAYS be long enough to contain every move (plus the
    // last move's full slot), so no move is ever skipped.
    this._totalMs = Math.max(
      totalMsOverride != null && totalMsOverride > 0 ? totalMsOverride : 0,
      moves.length * this.moveSpacingMs,
    );

    this.nextIndex = 0;
    this._positionMs = 0;
    this.lastAppliedOrientation = -1;
    this.scrambleRotations = [];
    this.setState('idle');
  }

  /** Update the orientation timeline (e.g., after reloading solve data). */
  public setOrientationTimeline(timeline: OrientationTimeline | undefined): void {
    this.orientationTimeline = timeline;
    this.lastAppliedOrientation = -1;
  }

  /**
   * Parse and apply the initial scramble so the 3D cube shows the
   * scrambled state at position 0 (before any solve moves are replayed).
   *
   * Must be called once after the engine is created and the renderer is
   * ready. The scramble rotations are stored and re-applied automatically
   * during every seek() call.
   *
   * After this, the replay starts from scrambled → ends solved.
   */
  public async applyInitialScramble(scramble: string): Promise<void> {
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    this.scrambleRotations = tokens.map((token) => {
      const face = token[0] as CubeFace;
      const suffix = token.length > 1 ? token[1] : '';
      const direction = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
      const mapping = FACE_ROTATION_MAP[face];
      const angle = direction * (mapping?.angleSign ?? 1) * 90;
      return {
        axis: (mapping?.axis ?? 'y') as RotationAxis,
        layerValues: [mapping?.layerValue ?? 0],
        angle,
        offsetMs: -1, // before time 0, never re-applied by tick loop
        hostTimestamp: 0,
      };
    });

    // Apply scramble rotations to the visual cube immediately
    // (the renderer starts in solved state; this makes it scrambled)
    for (const sr of this.scrambleRotations) {
      const prom = this.callbacks.rotateLayers(sr.axis, sr.layerValues, sr.angle, 0);
      if (prom instanceof Promise) await prom;
    }
  }

  /** Start or resume playback. */
  public async play(): Promise<void> {
    if (this._state === 'complete') {
      // Restart from beginning — await the seek so the cube is fully
      // reset before we start the tick loop. Without this, tick() races
      // against the async resetCube + rotateLayers inside seek(0).
      await this.seek(0);
    }
    if (this._state === 'playing') return;
    if (this.rotations.length === 0) return;

    this.resumePositionMs = this._positionMs;
    this.playStartWall = performance.now();
    this.setState('playing');
    this.tick();
  }

  /** Pause at current position. */
  public pause(): void {
    if (this._state !== 'playing') return;
    this.cancelRaf();
    this._positionMs = this.computePosition();
    this.setState('paused');
  }

  /** Stop and reset to the beginning. */
  public stop(): void {
    this.cancelRaf();
    this._positionMs = 0;
    this.nextIndex = 0;
    this.setState('idle');
  }

  /**
   * Seek to a specific time position (ms from solve start).
   * Resets the cube and fast-applies all moves up to that point.
   */
  public async seek(targetMs: number): Promise<void> {
    const wasPlaying = this._state === 'playing';
    this.cancelRaf();

    const clampedMs = Math.max(0, Math.min(targetMs, this._totalMs));
    this._positionMs = clampedMs;

    // Fast-forward: reset cube + apply scramble + re-apply solve moves
    this.setState('seeking');
    await this.callbacks.resetCube();
    this.lastAppliedOrientation = -1;

    // Apply stored scramble rotations so the cube starts from the
    // correct scrambled state, not from solved.
    for (const sr of this.scrambleRotations) {
      await this.callbacks.rotateLayers(sr.axis, sr.layerValues, sr.angle, 0);
    }

    this.nextIndex = 0;
    for (let i = 0; i < this.rotations.length; i++) {
      const r = this.rotations[i];
      if (r.offsetMs > clampedMs) break;
      const p = this.rotations[i];
      await this.callbacks.rotateLayers(p.axis, p.layerValues, p.angle, 0);
      this.nextIndex = i + 1;
      // Apply orientation at this move index during seek (instant snap, no animation)
      this.applyOrientationAt(i, 0);
    }

    this.onPosition?.(clampedMs, this.nextIndex - 1);

    if (wasPlaying && clampedMs < this._totalMs) {
      this.resumePositionMs = clampedMs;
      this.playStartWall = performance.now();
      this.setState('playing');
      this.tick();
    } else if (clampedMs >= this._totalMs) {
      this.setState('complete');
      this.onComplete?.();
    } else {
      this.setState('paused');
    }
  }

  /** Change playback speed (0.25, 0.5, 1, 2, etc.). */
  public setSpeed(speed: number): void {
    const clamped = Math.max(0.1, Math.min(speed, 10));
    if (this._state === 'playing') {
      // Adjust timing so we don't jump on speed change
      this._positionMs = this.computePosition();
      this.resumePositionMs = this._positionMs;
      this.playStartWall = performance.now();
    }
    this._speed = clamped;
  }

  /** Step forward one move (pauses playback). */
  public async stepForward(): Promise<void> {
    const wasPlaying = this._state === 'playing';
    this.cancelRaf();

    if (wasPlaying) {
      this._positionMs = this.computePosition();
    }

    // Find the next move after current position
    const targetIdx = this.nextIndex;
    if (targetIdx >= this.rotations.length) {
      this.setState('complete');
      this.onComplete?.();
      return;
    }

    const r = this.rotations[targetIdx];
    this._positionMs = r.offsetMs;
    
    // Apply with animation
    const duration = Math.min(this.moveAnimationDurationMs, this._totalMs - r.offsetMs);
    await this.callbacks.rotateLayers(r.axis, r.layerValues, r.angle, duration);
    this.nextIndex = targetIdx + 1;

    this.onPosition?.(this._positionMs, targetIdx);
    this.onMove?.(targetIdx, this.rotations.length);
    this.setState('paused');
  }

  /** Step backward one move (pauses playback). */
  public async stepBackward(): Promise<void> {
    this.cancelRaf();

    // No moves applied → already at start
    if (this.nextIndex === 0) return;

    const targetIdx = this.nextIndex - 1;
    const lastRot = this.rotations[targetIdx];

    // Apply the inverse rotation with animation so the cube visually
    // undoes the last move instead of resetting + fast-forwarding.
    // This is O(1) and avoids the visual flash of resetCube().
    const inverseAngle = -lastRot.angle;
    await this.callbacks.rotateLayers(
      lastRot.axis,
      lastRot.layerValues,
      inverseAngle,
      this.moveAnimationDurationMs,
    );

    // Update position and index to reflect the undone move
    this.nextIndex = targetIdx;
    this._positionMs =
      targetIdx > 0 ? this.rotations[targetIdx - 1].offsetMs : 0;

    // Apply orientation at the new position (the move before the undone one)
    // Use animation duration for smooth visual during step-backward
    this.applyOrientationAt(Math.max(0, this.nextIndex - 1), this.moveAnimationDurationMs);

    this.onPosition?.(this._positionMs, this.nextIndex - 1);
    this.setState('paused');
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  public get speed(): number { return this._speed; }
  public get state(): ReplayState { return this._state; }
  public get totalMs(): number { return this._totalMs; }
  public get positionMs(): number {
    return this._state === 'playing' ? this.computePosition() : this._positionMs;
  }
  public get moveCount(): number { return this.rotations.length; }
  public get currentMoveIndex(): number {
    return Math.max(0, this.nextIndex - 1);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  /** Compute the current virtual position from wall clock. */
  private computePosition(): number {
    const elapsed = (performance.now() - this.playStartWall) * this._speed;
    return Math.min(this.resumePositionMs + elapsed, this._totalMs);
  }

  /** Main animation loop. */
  private tick = (): void => {
    if (this._state !== 'playing') return;

    const pos = this.computePosition();

    // Apply all moves whose offset <= current position
    while (
      this.nextIndex < this.rotations.length &&
      this.rotations[this.nextIndex].offsetMs <= pos
    ) {
      const r = this.rotations[this.nextIndex];
      // Calculate how much of this move's time window has elapsed,
      // so the 3D animation picks up at the right visual stage.
      const prevOffsetMs = this.nextIndex > 0
        ? this.rotations[this.nextIndex - 1].offsetMs
        : 0;
      const moveDuration = Math.max(0, r.offsetMs - prevOffsetMs);
      const elapsedWithinMove = Math.max(0, pos - r.offsetMs);

      // Use a fixed animation duration that feels natural,
      // with dead-reckoning via elapsedMs for speed > 1.
      const animDuration = Math.min(this.moveAnimationDurationMs, moveDuration || this.moveAnimationDurationMs);
      const elapsedAnim = elapsedWithinMove > 0
        ? Math.min(elapsedWithinMove * this._speed, animDuration)
        : 0;

      // The callback may return void or a Promise; handle both.
      const prom = this.callbacks.rotateLayers(r.axis, r.layerValues, r.angle, animDuration, elapsedAnim);
      if (prom instanceof Promise) prom.catch(() => {});
      this.nextIndex++;
      this.onMove?.(this.nextIndex - 1, this.rotations.length);
      // Apply orientation at this move index with smooth animation
      this.applyOrientationAt(this.nextIndex - 1, this.moveAnimationDurationMs);
    }

    this._positionMs = pos;
    this.onPosition?.(pos, Math.max(0, this.nextIndex - 1));

    if (pos >= this._totalMs) {
      this.setState('complete');
      this.onComplete?.();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private setState(state: ReplayState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Clean up resources. */
  public dispose(): void {
    this.cancelRaf();
    this.onPosition = null;
    this.onComplete = null;
    this.onMove = null;
    this.onStateChange = null;
  }

  /**
   * Apply the orientation for the given move index from the timeline.
   * Uses getOrientationAtIndex to find the correct keyframe.
   * Passes animationDurationMs so the renderer can smoothly SLERP the
   * cube root instead of hard-snapping.
   *
   * @param moveIndex - Current move index in the solve
   * @param animateMs - Duration for the orientation animation (0 = instant snap for seeking)
   */
  private applyOrientationAt(moveIndex: number, animateMs = 0): void {
    if (!this.orientationTimeline || !this.callbacks.setOrientation) return;
    
    // Find the orientation index for this move
    let orientationIndex = 0;
    for (const [mi, oi] of this.orientationTimeline) {
      if (mi <= moveIndex) {
        orientationIndex = oi;
      } else {
        break;
      }
    }

    if (orientationIndex !== this.lastAppliedOrientation) {
      this.lastAppliedOrientation = orientationIndex;
      const prom = this.callbacks.setOrientation(orientationIndex, animateMs);
      if (prom instanceof Promise) prom.catch(() => {});
    }
  }
}
