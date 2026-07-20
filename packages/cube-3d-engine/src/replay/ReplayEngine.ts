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
import type { CubeFace, CubeMoveEvent, RotationAxis } from '@cubeforge/types';

// ─── Types ─────────────────────────────────────────────────────────────────

/** How to rotate a single layer for one move. */
export interface RotationParams {
  axis: RotationAxis;
  layerValues: number[];
  angle: number;
  /** When this move happened relative to solve start (ms). */
  offsetMs: number;
  /** The hostTimestamp from the move event (for delta calculations). */
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
}

/** Playback states. */
export type ReplayState = 'idle' | 'playing' | 'paused' | 'seeking' | 'complete';

// ─── ReplayEngine ──────────────────────────────────────────────────────────

export class ReplayEngine {
  /** The list of moves with pre-computed rotation params. */
  private rotations: RotationParams[] = [];
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

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor(
    moves: CubeMoveEvent[],
    callbacks: ReplayCallbacks,
    totalMs?: number,
  ) {
    this.callbacks = callbacks;
    this.setMoves(moves, totalMs);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Replace the move sequence (stops playback). */
  public setMoves(moves: CubeMoveEvent[], totalMsOverride?: number): void {
    this.stop();

    const firstTs = moves.length > 0 ? moves[0].hostTimestamp : 0;
    this.rotations = moves.map((m) => {
      const mapping = FACE_ROTATION_MAP[m.face as CubeFace];
      const angle = m.direction * (mapping?.angleSign ?? 1) * 90;
      return {
        axis: (mapping?.axis ?? 'y') as RotationAxis,
        layerValues: [mapping?.layerValue ?? 0],
        angle,
        offsetMs: m.hostTimestamp - firstTs,
        hostTimestamp: m.hostTimestamp,
      };
    });

    // Use the override (timer time) when provided; fall back to move span.
    this._totalMs =
      totalMsOverride != null && totalMsOverride > 0
        ? totalMsOverride
        : moves.length > 1
          ? moves[moves.length - 1].hostTimestamp - firstTs
          : 0;
    if (moves.length === 1 && totalMsOverride == null) this._totalMs = 0;

    this.nextIndex = 0;
    this._positionMs = 0;
    this.setState('idle');
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

    // Fast-forward: reset cube + re-apply moves with duration=0
    this.setState('seeking');
    await this.callbacks.resetCube();

    this.nextIndex = 0;
    for (let i = 0; i < this.rotations.length; i++) {
      const r = this.rotations[i];
      if (r.offsetMs > clampedMs) break;
      const p = this.rotations[i];
      await this.callbacks.rotateLayers(p.axis, p.layerValues, p.angle, 0);
      this.nextIndex = i + 1;
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

    // Target move index = previous move
    const targetIdx = Math.max(0, this.nextIndex - 1);
    const targetMs = targetIdx > 0
      ? this.rotations[targetIdx - 1].offsetMs
      : 0;

    await this.seek(targetMs);
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
}
