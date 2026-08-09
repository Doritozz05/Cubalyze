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
  /**
   * Force-complete every in-flight animation in the renderer (layer rotations
   * + root orientation SLERP). Called before every absolute reset (seek) so a
   * rotation that is still turning when the reset happens can never snap
   * afterwards and re-apply itself on top of the freshly reset cube (the
   * "cube colors lost/buggy after restart/step" bug family). Optional: the
   * renderer may also flush internally inside resetCube().
   */
  flushAnimations?: () => void | Promise<void>;
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

  /**
   * Transport serialization chain: play / pause / seek / stepForward /
   * stepBackward queue behind each other instead of interleaving their async
   * bodies. Rapid control clicks (e.g. double-tap Step backward while the
   * previous step is still animating) used to read the same `nextIndex`
   * before either completed → double-applied inverses → the cube's visual
   * state desynced from the move counter.
   */
  private opChain: Promise<unknown> = Promise.resolve();

  private enqueueOp<T>(op: () => Promise<T>): Promise<T> {
    const run = this.opChain.then(op);
    this.opChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

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

  /** Duration per move animation (ms). Default is 350ms (~70% of standard move slot). */
  public moveAnimationDurationMs = 350;

  /**
   * Duration for whole-cube GRIP rotations (inspection + mid-solve
   * orientation keyframes). These are not moves — the solver turning the
   * cube in hand — so they get a slower, deliberate feel. The next move
   * continues on its own timeline slot, so a sub-slot rotation never
   * delays playback.
   */
  public orientationAnimationDurationMs = 260;

  /**
   * Duration of the INSPECTION pre-roll: the slow grip rotation the cube
   * performs when playback starts at position 0, BEFORE move 1 runs. The
   * engine awaits its completion, so no move starts while the cube is
   * still turning to the solver's starting perspective.
   */
  public preRollDurationMs = 600;

  /**
   * Whether the inspection pre-roll may run at all. Reconstruction solves
   * (raw solver-frame moves) re-enact the solver's grip — enabled. Smart-cube
   * solves (physical moves + IMU timeline) can carry a first keyframe that is
   * merely a HELD orientation (no rotation happened in the solve window), so
   * callers disable this to avoid a phantom grip.
   */
  public preRollEnabled = true;

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

  /**
   * The orientation SEQUENCE the cube must GRIP at position 0 (the
   * inspection rotations), or [] when there is none. Every timeline keyframe
   * at event 0 is one rotation token (uncompressed timeline) — the pre-roll
   * animates them ONE AFTER ANOTHER (z, then y2 — not one diagonal SLERP).
   */
  private preRollOrientations: number[] = [];
  /** True once the pre-roll grip has been applied for the current session
   *  (reset by seek/stop/setMoves so restart replays the inspection). */
  private preRollApplied = false;
  /** True while the pre-roll grip animation is awaiting completion. */
  private gripAnimating = false;
  /** The in-flight pre-roll promise (so step/seek can wait for it). */
  private gripPromise: Promise<void> | null = null;
  /**
   * True while the tick's mid-solve orientation CHAIN is animating (one or
   * more consecutive rotations). The next move waits for it to finish — a
   * rotation completes before the following move starts, like the solver
   * turning the cube in hand.
   */
  private orientationBusy = false;
  /** The in-flight mid-solve chain promise (so seek/step can wait for it,
   *  exactly like gripPromise). */
  private orientationChainPromise: Promise<void> | null = null;
  /**
   * Monotonic generation for the orientation chain — a stale chain's
   * `.finally()` only clears the busy flag if its generation is still
   * current, so a newer chain can never have its gate opened early by an
   * older one's cleanup.
   */
  private orientationChainGen = 0;
  /** Index (into preRollOrientations) of the grip step currently animating.
   *  Pause snaps the cube to THIS step's target, not the composed final. */
  private preRollStepIndex = 0;

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
      // Sanitize a malformed/NaN direction to a no-op (0°) instead of letting
      // NaN reach the rotation engine, where setFromAxisAngle(NaN) corrupts
      // the cubie quaternion → culled/black stickers.
      const dir = Number.isFinite(m.direction) ? m.direction : 0;
      const angle = dir * (mapping?.angleSign ?? 1) * 90;
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
    this.orientationBusy = false;
    this.orientationChainGen = 0;
    this.orientationChainPromise = null;
    this.scrambleRotations = [];
    this.computePreRoll();
    this.setState('idle');
  }

  /**
   * Derive the inspection pre-roll orientation SEQUENCE from the timeline.
   *
   * Every keyframe at move 0 is a rotation token that happened BEFORE move 1
   * (the inspection) — e.g. "z y2" yields keyframes [0, z] and [0, z∘y2].
   * Playback re-enacts each grip step in order, slowly, before any move is
   * applied. Identity or absent keyframes mean no pre-roll.
   */
  private computePreRoll(): void {
    this.preRollOrientations = [];
    this.preRollStepIndex = 0;
    if (this.orientationTimeline) {
      // Timeline is sorted by move index — all event-0 entries come first.
      for (const [mi, oi] of this.orientationTimeline) {
        if (mi !== 0) break;
        if (oi === 0) continue; // identity — nothing to grip
        // Skip consecutive duplicates (a no-op rotation adds no visual step).
        if (oi === this.preRollOrientations[this.preRollOrientations.length - 1]) continue;
        this.preRollOrientations.push(oi);
      }
    }
    this.preRollApplied = false;
  }

  /** Update the orientation timeline (e.g., after reloading solve data). */
  public setOrientationTimeline(timeline: OrientationTimeline | undefined): void {
    this.orientationTimeline = timeline;
    this.lastAppliedOrientation = -1;
    this.computePreRoll();
  }

  /**
   * The in-flight initial-scramble application (see applyInitialScramble).
   * play() awaits it before queueing any solve move so the scramble's
   * messages can never be interleaved with the solve's. Null when no
   * scramble is being applied.
   */
  private scramblePromise: Promise<void> | null = null;

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
  public applyInitialScramble(scramble: string): Promise<void> {
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
    // (the renderer starts in solved state; this makes it scrambled).
    //
    // The whole dispatch is tracked in `scramblePromise`: play() waits for
    // it before it can queue ANY solve move. Without this, play() called
    // while the scramble is still being dispatched (the renderer applies
    // each move over its own async roundtrip) would enqueue the solve moves
    // BETWEEN the scramble moves — the worker FIFO then processes
    // [s₁, solve₁, s₂..s₂₀, solve₂..s₃₁], which is NOT scramble→solve, so
    // the cube ends visually unsolved while the UI counter still reports
    // "Move 31/31" (the reported random bug — it only reproduces when the
    // user hits play before the scramble finished dispatching).
    //
    // Per-move failures are swallowed: the scramble is best-effort cosmetic
    // state and a rejection must never block playback or leak as an
    // unhandled rejection.
    const dispatch = (async () => {
      for (const sr of this.scrambleRotations) {
        const prom = this.callbacks.rotateLayers(sr.axis, sr.layerValues, sr.angle, 0);
        if (prom instanceof Promise) await prom.catch(() => {});
      }
    })();
    this.scramblePromise = dispatch;
    void dispatch.then(() => {
      if (this.scramblePromise === dispatch) this.scramblePromise = null;
    });
    return dispatch;
  }

  /**
   * Wait for any in-flight initial-scramble dispatch to settle (see
   * applyInitialScramble). Every move-dispatching entry point (play, seek,
   * stepForward, stepBackward) calls this first so its messages can never be
   * queued BETWEEN the scramble messages. Errors are swallowed: the scramble
   * is best-effort cosmetic state and must never block transport controls.
   */
  private async awaitScrambleSettled(): Promise<void> {
    if (this.scramblePromise) {
      try { await this.scramblePromise; } catch { /* best-effort */ }
    }
  }

  /** Start or resume playback. */
  public play(): Promise<void> {
    // Serialize behind any in-flight transport op — a play() clicked while a
    // seek/step is still applying must queue, never interleave.
    return this.enqueueOp(() => this.playImpl());
  }

  private async playImpl(): Promise<void> {
    if (this._state === 'complete') {
      // Restart from beginning — await the seek so the cube is fully
      // reset before we start the tick loop. Without this, tick() races
      // against the async resetCube + rotateLayers inside seek(0).
      await this.seekImpl(0);
    }
    // Bail if a seek is in flight too — the transport owns the cube while
    // it fast-forwards, and a second tick would double-apply moves.
    if (this._state === 'playing' || this._state === 'seeking') return;
    if (this.rotations.length === 0) return;

    // ── Initial-scramble gate ────────────────────────────────────────────
    // The renderer applies the scramble asynchronously (one roundtrip per
    // move). Starting playback before every scramble message was dispatched
    // would queue the solve moves BETWEEN the scramble moves (see
    // applyInitialScramble) and leave the cube visually unsolved at the end.
    // Wait for the scramble to finish dispatching, then re-check the state:
    // if a concurrent play() won the gate and already started the tick, bail
    // out so only ONE tick loop ever runs.
    await this.awaitScrambleSettled();
    if (this._state !== 'idle' && this._state !== 'paused') return;

    this.resumePositionMs = this._positionMs;
    this.playStartWall = performance.now();
    this.setState('playing');

    // ── Inspection pre-roll ─────────────────────────────────────────────
    // Reconstructions write their moves in the SOLVER frame. The cube root
    // must grip the solver's starting orientation (the inspection rotation)
    // BEFORE move 1 — a slow, deliberate turn that does NOT count as a move.
    // Playback waits for it to finish: the next move is never applied while
    // the cube is still turning.
    if (
      this.preRollEnabled &&
      this.preRollOrientations.length > 0 &&
      !this.preRollApplied &&
      this._positionMs === 0 &&
      this.callbacks.setOrientation
    ) {
      this.gripAnimating = true;
      // Sequential grip: each inspection rotation animates fully BEFORE the
      // next one starts (z, then y2 — never one diagonal rotation), and no
      // move runs until every step has finished.
      for (const oi of this.preRollOrientations) {
        const duration = this.preRollDurationMs / Math.max(0.1, this._speed);
        const prom = this.callbacks.setOrientation(oi, duration);
        if (prom instanceof Promise) {
          this.gripPromise = prom;
          await prom.catch(() => {});
          this.gripPromise = null;
        }
        // This step completed — pause() now snaps to the CURRENT step's
        // target (not the composed final) so the cube doesn't jump grips.
        this.preRollStepIndex++;
        this.gripAnimating = false;
        // Paused/stopped mid-grip → don't start playback, and DON'T mark the
        // grip as applied — the next play() retries the pre-roll from wherever
        // the root is. (Read through the getter: TS cannot see setState()
        // mutating _state, and the earlier `if (this._state === 'playing')
        // return` would narrow it away.)
        if (this.state !== 'playing') return;
      }
      this.preRollApplied = true;
      // The wall clock advanced during the grip — reset it so move 0
      // starts fresh from position 0. Also mark the final orientation as
      // applied so the tick doesn't re-fire setOrientation on move 0.
      this.resumePositionMs = 0;
      this.playStartWall = performance.now();
      this.lastAppliedOrientation =
        this.preRollOrientations[this.preRollOrientations.length - 1];
    }

    this.tick();
  }

  /** Pause at current position. */
  public pause(): void {
    if (this._state !== 'playing') return;
    this.cancelRaf();
    // Mid-grip pause: the virtual clock hasn't started yet (no move applied),
    // so stay at position 0 instead of sampling a bogus wall-clock offset.
    // Snap the cube to the grip orientation so the slow turn doesn't keep
    // playing while the transport says "paused" (this also resolves the
    // in-flight grip promise, letting play() exit cleanly at its guard).
    this._positionMs = this.gripAnimating ? 0 : this.computePosition();
    if (
      this.gripAnimating &&
      this.preRollOrientations.length > 0 &&
      this.callbacks.setOrientation
    ) {
      // Snap the cube to the step currently turning so the slow turn doesn't
      // keep playing while the transport says "paused" (this also resolves
      // the in-flight grip promise, letting play() exit cleanly at its
      // guard) — and the cube stops at THIS step's grip, not the final one.
      const snapOi = this.preRollOrientations[
        Math.min(this.preRollStepIndex, this.preRollOrientations.length - 1)
      ];
      const prom = this.callbacks.setOrientation(snapOi, 0);
      if (prom instanceof Promise) prom.catch(() => {});
    }
    this.setState('paused');
  }

  /** Stop and reset to the beginning. */
  public stop(): void {
    this.cancelRaf();
    this._positionMs = 0;
    this.nextIndex = 0;
    this.preRollApplied = false;
    this.orientationBusy = false;
    this.orientationChainGen = 0;
    this.orientationChainPromise = null;
    this.setState('idle');
  }

  /**
   * Seek to a specific time position (ms from solve start).
   * Resets the cube and fast-applies all moves up to that point.
   */
  public seek(targetMs: number): Promise<void> {
    return this.enqueueOp(() => this.seekImpl(targetMs));
  }

  private async seekImpl(targetMs: number): Promise<void> {
    const wasPlaying = this._state === 'playing';
    this.cancelRaf();
    // Wait out any in-flight initial-scramble dispatch (the Restart button is
    // enabled while applyInitialScramble is still round-tripping) so this
    // rewind's own reset + scramble loop can never interleave with it.
    await this.awaitScrambleSettled();
    // Wait out any in-flight inspection grip before rewinding.
    if (this.gripPromise) {
      try { await this.gripPromise; } catch { /* aborted grip */ }
      this.gripPromise = null;
      this.gripAnimating = false;
    }
    // …and any in-flight mid-solve orientation chain, so the rewind's snaps
    // don't interleave with a still-running rotation.
    if (this.orientationChainPromise) {
      try { await this.orientationChainPromise; } catch { /* aborted chain */ }
      this.orientationChainPromise = null;
      this.orientationBusy = false;
    }

    const clampedMs = Math.max(0, Math.min(targetMs, this._totalMs));
    this._positionMs = clampedMs;

    // Fast-forward: reset cube + apply scramble + re-apply solve moves.
    // CRITICAL: force-complete every animation still turning in the renderer
    // (the tick dispatches rotateLayers fire-and-forget) BEFORE the reset —
    // otherwise the stale task snaps after resetCube and re-applies its
    // rotation + logical update on top of the fresh state (the reported
    // "replay colors lost/buggy" after Restart / seek / step).
    this.setState('seeking');
    // Best-effort flush: a renderer torn down mid-seek (worker terminated)
    // must never surface as an unhandled rejection from the transport.
    try {
      await this.callbacks.flushAnimations?.();
    } catch { /* renderer gone — the reset below is still safe */ }
    await this.callbacks.resetCube();
    this.lastAppliedOrientation = -1;
    this.orientationBusy = false;
    this.orientationChainGen = 0;

    // Apply stored scramble rotations so the cube starts from the
    // correct scrambled state, not from solved.
    for (const sr of this.scrambleRotations) {
      await this.callbacks.rotateLayers(sr.axis, sr.layerValues, sr.angle, 0);
    }

    this.nextIndex = 0;
    for (let i = 0; i < this.rotations.length; i++) {
      const r = this.rotations[i];
      if (clampedMs === 0 || r.offsetMs > clampedMs) break;
      const p = this.rotations[i];
      await this.callbacks.rotateLayers(p.axis, p.layerValues, p.angle, 0);
      this.nextIndex = i + 1;
      // Apply orientation at this move index during seek (instant snap, no animation)
      this.applyOrientationAt(i, 0);
    }
    // Rewinding to the start resets the session so the next play() replays
    // the inspection pre-roll grip.
    if (clampedMs === 0) this.preRollApplied = false;

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
    // Sanitize NaN so it can never propagate into tick()'s animation
    // duration math (NaN / speed → NaN durations → NaN slerp in the engine).
    const clamped = Number.isFinite(speed)
      ? Math.max(0.1, Math.min(speed, 10))
      : 1;
    if (this._state === 'playing') {
      // Adjust timing so we don't jump on speed change
      this._positionMs = this.computePosition();
      this.resumePositionMs = this._positionMs;
      this.playStartWall = performance.now();
    }
    this._speed = clamped;
  }

  /** Step forward one move (pauses playback). */
  public stepForward(): Promise<void> {
    return this.enqueueOp(() => this.stepForwardImpl());
  }

  private async stepForwardImpl(): Promise<void> {
    const wasPlaying = this._state === 'playing';
    this.cancelRaf();
    // Same gate as play(): the step buttons are enabled during the initial
    // scramble apply, and a step's move must never queue between scramble
    // messages.
    await this.awaitScrambleSettled();
    // Wait out any in-flight inspection grip so the step applies after it.
    if (this.gripPromise) {
      try { await this.gripPromise; } catch { /* aborted grip */ }
      this.gripPromise = null;
      this.gripAnimating = false;
    }
    // …and any in-flight orientation chain, so the step doesn't interleave
    // rotations with a still-running one (last-wins in the engine, but racy).
    if (this.orientationChainPromise) {
      try { await this.orientationChainPromise; } catch { /* aborted chain */ }
      this.orientationChainPromise = null;
      this.orientationBusy = false;
    }

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

    // Mark the transport as seeking so the UI disables the control buttons
    // while this step's animation is still turning.
    this.setState('seeking');
    const r = this.rotations[targetIdx];
    
    // Apply with animation
    const duration = Math.min(this.moveAnimationDurationMs, this._totalMs - r.offsetMs);
    await this.callbacks.rotateLayers(r.axis, r.layerValues, r.angle, duration);
    this.nextIndex = targetIdx + 1;
    this._positionMs = r.offsetMs;

    this.onPosition?.(this._positionMs, targetIdx);
    this.onMove?.(targetIdx, this.rotations.length);
    // Mark paused BEFORE the grip animation: the orientation chain checks the
    // transport state and aborts while it is 'seeking' — with the step still
    // marked 'seeking', only the first rotation of a consecutive run would
    // animate. The move itself is already applied, so 'paused' is accurate.
    this.setState('paused');
    // Apply orientation at the new position (smooth, like stepBackward) so
    // stepping through a solve with an orientation timeline follows the
    // solver's perspective instead of freezing the cube. Whole-cube grips
    // use the slower orientation duration.
    this.applyOrientationAt(targetIdx, this.orientationAnimationDurationMs);
  }

  /** Step backward one move (pauses playback). */
  public stepBackward(): Promise<void> {
    return this.enqueueOp(() => this.stepBackwardImpl());
  }

  private async stepBackwardImpl(): Promise<void> {
    this.cancelRaf();
    // Same gate as play(): the step buttons are enabled during the initial
    // scramble apply, and a step's move must never queue between scramble
    // messages.
    await this.awaitScrambleSettled();
    // Wait out any in-flight inspection grip before undoing.
    if (this.gripPromise) {
      try { await this.gripPromise; } catch { /* aborted grip */ }
      this.gripPromise = null;
      this.gripAnimating = false;
    }
    // …and any in-flight orientation chain, so the undo doesn't interleave
    // rotations with a still-running one.
    if (this.orientationChainPromise) {
      try { await this.orientationChainPromise; } catch { /* aborted chain */ }
      this.orientationChainPromise = null;
      this.orientationBusy = false;
    }

    // No moves applied → already at start
    if (this.nextIndex === 0) return;

    // Mark the transport as seeking so the UI disables the control buttons
    // while this step's animation is still turning (rapid double-clicks
    // otherwise re-read the same nextIndex → double-applied inverse).
    this.setState('seeking');
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
    this._positionMs = targetIdx > 0 ? this.rotations[targetIdx - 1].offsetMs : 0;

    this.onPosition?.(this._positionMs, this.nextIndex - 1);
    // Mark paused BEFORE the grip animation — the orientation chain aborts
    // while the transport state is 'seeking' (see stepForwardImpl).
    this.setState('paused');
    // Apply orientation at the new position (the move before the undone one)
    // Use animation duration for smooth visual during step-backward.
    this.applyOrientationAt(Math.max(0, this.nextIndex - 1), this.orientationAnimationDurationMs);
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
    return this.nextIndex - 1;
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

    // Apply all moves whose offset <= current position. A move WAITS while
    // the previous move's orientation chain is still animating — rotations
    // finish before the next move starts (the solver turns the cube in hand,
    // then turns the layer).
    while (
      this.nextIndex < this.rotations.length &&
      this.rotations[this.nextIndex].offsetMs <= pos &&
      !this.orientationBusy
    ) {
      const r = this.rotations[this.nextIndex];
      // Calculate how much of this move's time window has elapsed,
      // so the 3D animation picks up at the right visual stage.
      const prevOffsetMs = this.nextIndex > 0
        ? this.rotations[this.nextIndex - 1].offsetMs
        : 0;
      const moveDuration = Math.max(0, r.offsetMs - prevOffsetMs);
      const elapsedWithinMove = Math.max(0, pos - r.offsetMs);

      // Scale animation duration inversely by playback speed so that
      // at slow speeds (e.g. 0.25x), the 3D rotation animation itself plays slowly
      // across the move slot rather than snapping quickly and pausing.
      const moveSlot = moveDuration || this.moveSpacingMs;
      const targetAnimDuration = this.moveAnimationDurationMs / Math.max(0.1, this._speed);
      const maxAnimDuration = (moveSlot / Math.max(0.1, this._speed)) * 0.85;
      const animDuration = Math.min(targetAnimDuration, maxAnimDuration);
      const elapsedAnim = elapsedWithinMove > 0
        ? Math.min(elapsedWithinMove / Math.max(0.1, this._speed), animDuration)
        : 0;

      // The callback may return void or a Promise; handle both.
      const prom = this.callbacks.rotateLayers(r.axis, r.layerValues, r.angle, animDuration, elapsedAnim);
      if (prom instanceof Promise) prom.catch(() => {});
      this.nextIndex++;
      this.onMove?.(this.nextIndex - 1, this.rotations.length);
      // Apply orientation at this move index with smooth animation. Cap the
      // duration by the remaining slot (speed-adjusted) so a grip rotation
      // never overlaps the next move's start at higher speeds.
      const orientationDuration = Math.min(
        this.orientationAnimationDurationMs / Math.max(0.1, this._speed),
        this.moveSpacingMs / Math.max(0.1, this._speed),
      );
      this.applyOrientationAt(this.nextIndex - 1, orientationDuration);
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
    this.scramblePromise = null;
    this.onPosition = null;
    this.onComplete = null;
    this.onMove = null;
    this.onStateChange = null;
  }

  /**
   * Apply the orientation for the given move index from the timeline.
   *
   * The timeline is UNCOMPRESSED: every rotation token is its own keyframe,
   * so consecutive rotations that happened before the same move (e.g. the
   * inspection "z y2" both at event 0) form a RUN sharing that move index.
   * This method animates the run's orientations ONE AFTER ANOTHER — z fully,
   * then y2 — instead of one diagonal SLERP straight to the composed
   * orientation.
   *
   * The next move in the tick waits while the chain runs (orientationBusy),
   * so a rotation always finishes before the following move starts.
   *
   * @param moveIndex - Current move index in the solve
   * @param animateMs - Per-step animation duration (0 = instant snap for seeking)
   */
  private applyOrientationAt(moveIndex: number, animateMs = 0): void {
    if (!this.orientationTimeline || !this.callbacks.setOrientation) return;

    // Last keyframe whose move index is <= moveIndex (timeline is sorted).
    let lastIdx = -1;
    for (let k = 0; k < this.orientationTimeline.length; k++) {
      if (this.orientationTimeline[k][0] <= moveIndex) lastIdx = k;
      else break;
    }
    if (lastIdx < 0) return;

    const prevApplied = this.lastAppliedOrientation;
    const finalOi = this.orientationTimeline[lastIdx][1];
    if (finalOi === prevApplied) return;
    this.lastAppliedOrientation = finalOi;

    // Collect the run of keyframes sharing the last keyframe's move index
    // (the consecutive rotations that happened before this move), preserving
    // order and dropping no-op duplicates. A leading orientation already
    // applied (e.g. re-firing [5,8] when at 5) is skipped — only the unseen
    // tail animates.
    const atMove = this.orientationTimeline[lastIdx][0];
    let runStart = lastIdx;
    while (runStart > 0 && this.orientationTimeline[runStart - 1][0] === atMove) runStart--;
    const pending: number[] = [];
    for (let k = runStart; k <= lastIdx; k++) {
      const oi = this.orientationTimeline[k][1];
      if (oi === prevApplied && pending.length === 0) continue; // already there
      if (oi !== pending[pending.length - 1]) pending.push(oi);
    }
    if (pending.length === 0) return;

    if (animateMs <= 0) {
      // Snap (seeking): only the composed final orientation matters.
      const prom = this.callbacks.setOrientation(finalOi, 0);
      if (prom instanceof Promise) prom.catch(() => {});
      return;
    }

    // Animated chain — sequential, one rotation at a time. Each step gets
    // the orientation duration, capped so the chain stays within the next
    // move's slot (the tick's orientationBusy gate catches any overrun).
    // Playback-initiated chains stop as soon as the transport leaves
    // 'playing' (pause/stop); step-driven chains (state 'paused' throughout)
    // always run to the end.
    const perStep = Math.min(
      animateMs,
      this.moveSpacingMs / Math.max(0.1, this._speed),
    );
    const gen = ++this.orientationChainGen;
    const fromPlayback = this._state === 'playing';
    this.orientationBusy = true;
    const chain = (async () => {
      for (const oi of pending) {
        const prom = this.callbacks.setOrientation!(oi, perStep);
        if (prom instanceof Promise) await prom.catch(() => {});
        if (
          this._state === 'seeking' ||
          this._state === 'idle' ||
          (fromPlayback && this._state !== 'playing')
        ) break;
      }
    })();
    this.orientationChainPromise = chain;
    chain.finally(() => {
      // Only the CURRENT generation's cleanup may clear the busy flag — a
      // stale chain finishing after a newer one started must not open the
      // tick's gate early.
      if (gen === this.orientationChainGen) this.orientationBusy = false;
      if (this.orientationChainPromise === chain) this.orientationChainPromise = null;
    }).catch(() => {});
  }
}
