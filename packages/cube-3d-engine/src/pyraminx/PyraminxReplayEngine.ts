/**
 * @cubeforge/cube-3d-engine — Pyraminx Replay Engine
 *
 * Replays a sequence of WCA Pyraminx tokens (U, U', L, …, u, l', …) with the
 * same transport surface the cube's {@link ReplayEngine} exposes — play /
 * pause / seek / step / speed + position/move/complete/state callbacks — so
 * the ReplaySection UI drives both puzzles through one interface.
 *
 * The timeline is MOVE-DRIVEN, exactly like the cube path: every move owns a
 * fixed `moveSpacingMs` slot (position 0 = the scrambled state; move i plays
 * at offset (i+1)·spacing), so every token always plays back regardless of
 * the solve's real time.
 *
 * The renderer is injected through {@link PyraminxReplayDriver}, so the
 * transport is fully unit-testable without WebGL (the real driver wires a
 * main-thread {@link PyraminxEngine}).
 */
import type { PyraminxEngine } from './PyraminxEngine';
import { isValidPyraminxMoveString, resolvePyraminxMoveToken } from './PyraminxGeometry';

/** Transport states — the same set the cube ReplayEngine uses. */
export type PyraminxReplayState = 'idle' | 'playing' | 'paused' | 'complete' | 'seeking';

/** The puzzle operations the transport needs — injected (real engine or fake). */
export interface PyraminxReplayDriver {
  /** Restore the solved state (positions AND orientations). */
  reset(): void;
  /** Force-complete any in-flight turn (never double-applied on top of a seek). */
  flushAll(): void | Promise<void>;
  /** Apply one token with no animation (seeks + initial scramble). */
  applyTokenInstant(token: string): void | Promise<void>;
  /** Apply one token as an animated turn; resolves when it lands. */
  applyTokenAnimated(token: string, durationMs: number): Promise<void>;
}

/** The inverse of a single-step pyraminx token (U ↔ U', l ↔ l'). */
export function invertPyraminxToken(token: string): string {
  return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

/**
 * The real driver: wires a main-thread {@link PyraminxEngine}. Instant applies
 * run a 0-duration driver rotation and advance the pivot machinery once, so
 * they land synchronously (no rAF wait) with the logical state committed by
 * the same hooks the animated path uses — visual and logical states can never
 * drift apart.
 */
export function createPyraminxReplayDriver(engine: PyraminxEngine): PyraminxReplayDriver {
  return {
    reset: () => engine.reset(),
    flushAll: () => {
      engine.driver?.flushAll();
    },
    applyTokenInstant: (token) => {
      const resolved = resolvePyraminxMoveToken(token);
      if (!resolved) return;
      // rotateVertex with duration 0 snaps on the FIRST update() — drive one
      // update immediately so the promise resolves without waiting a frame.
      const done = engine.rotateVertex(resolved.vertex, resolved.scope, resolved.angleInDegrees, 0);
      engine.driver?.update(performance.now() + 1);
      void done;
    },
    applyTokenAnimated: async (token, durationMs) => {
      await engine.applyMove(token, Math.max(1, Math.round(durationMs)));
    },
  };
}

export class PyraminxReplayEngine {
  /** Duration per move slot (ms) — set by the host (ReplaySection). */
  public moveSpacingMs = 500;
  /** Base duration of one move's turn animation (ms). */
  public moveAnimationDurationMs = 350;
  /** Accepted for surface parity with the cube ReplayEngine — the Pyraminx
   *  has no orientation timeline, so these are inert. */
  public preRollDurationMs = 600;
  public orientationAnimationDurationMs = 280;
  public preRollEnabled = false;

  // ── Events (same surface as ReplayEngine) ──────────────────────────────
  public onPosition: ((positionMs: number, moveIndex: number) => void) | null = null;
  public onMove: ((moveIndex: number, totalMoves: number) => void) | null = null;
  public onComplete: (() => void) | null = null;
  public onStateChange: ((state: PyraminxReplayState) => void) | null = null;

  private readonly tokens: string[];
  private readonly driver: PyraminxReplayDriver;
  private scrambleTokens: string[] = [];

  private _speed = 1;
  private _state: PyraminxReplayState = 'idle';
  /** Index of the NEXT token to apply (0 = none applied). */
  private nextIndex = 0;
  private _positionMs = 0;
  private _totalMs: number;

  private resumePositionMs = 0;
  private playStartWall = 0;
  private rafId: number | null = null;

  constructor(tokens: string[], _totalDurationMs: number, driver: PyraminxReplayDriver) {
    this.tokens = tokens.filter((t) => t.length > 0);
    this.driver = driver;
    // Move-driven timeline: every token owns one spacing slot.
    this._totalMs = this.tokens.length * this.moveSpacingMs;
  }

  // ── Getters (surface parity) ───────────────────────────────────────────

  public get speed(): number {
    return this._speed;
  }
  public get state(): PyraminxReplayState {
    return this._state;
  }
  public get totalMs(): number {
    return this._totalMs;
  }
  public get positionMs(): number {
    return this._state === 'playing' ? this.computePosition() : this._positionMs;
  }
  public get moveCount(): number {
    return this.tokens.length;
  }
  public get currentMoveIndex(): number {
    return this.nextIndex - 1;
  }

  // ── Transport ──────────────────────────────────────────────────────────

  private setState(state: PyraminxReplayState): void {
    if (this._state === state) return;
    this._state = state;
    this.onStateChange?.(state);
  }

  private computePosition(): number {
    const elapsed = (performance.now() - this.playStartWall) * this._speed;
    return Math.min(this.resumePositionMs + elapsed, this._totalMs);
  }

  /**
   * Apply the scramble from the solved state so position 0 IS the scrambled
   * state (the replay then solves it move by move). Called by the host after
   * construction; every later seek re-applies it for an exact state.
   */
  public async applyInitialScramble(scramble: string): Promise<void> {
    const trimmed = (scramble ?? '').trim();
    const tokens = isValidPyraminxMoveString(trimmed)
      ? trimmed.split(/\s+/).filter(Boolean)
      : [];
    this.scrambleTokens = tokens;
    this.driver.flushAll();
    this.driver.reset();
    for (const token of tokens) await this.driver.applyTokenInstant(token);
    this.nextIndex = 0;
    this._positionMs = 0;
    this.onPosition?.(0, -1);
  }

  public async play(): Promise<void> {
    if (this._state === 'playing' || this.nextIndex >= this.tokens.length) return;
    this.setState('playing');
    this.resumePositionMs = this._positionMs;
    this.playStartWall = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  public pause(): void {
    if (this._state !== 'playing') return;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Freeze at the virtual position; the in-flight turn animation (if any)
    // keeps running to completion — the same behavior as the cube path.
    this._positionMs = this.computePosition();
    this.setState('paused');
  }

  /** Seek to an absolute timeline position (ms). Exact: reset + scramble +
   *  instant-apply every move whose slot boundary has passed. */
  public async seek(ms: number): Promise<void> {
    this.pause();
    this.setState('seeking');
    await this.driver.flushAll();
    this.driver.reset();
    for (const token of this.scrambleTokens) await this.driver.applyTokenInstant(token);
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    // A move is applied once its slot boundary has passed (move i starts at
    // (i+1)·spacing) — same inclusive-boundary rule as the cube ReplayEngine
    // (rotation.offsetMs <= clampedMs).
    const k = Math.max(
      0,
      Math.min(Math.floor(safeMs / this.moveSpacingMs), this.tokens.length),
    );
    for (let i = 0; i < k; i++) await this.driver.applyTokenInstant(this.tokens[i]);
    this.nextIndex = k;
    // Report the CLAMPED target (like the cube engine) — the timeline
    // playhead lands on the requested position, not the slot boundary.
    this._positionMs = safeMs;
    this.onPosition?.(safeMs, k - 1);
    if (k >= this.tokens.length) {
      this.setState('complete');
      this.onComplete?.();
    } else {
      this.setState('paused');
    }
  }

  public async stepForward(): Promise<void> {
    if (this.nextIndex >= this.tokens.length) return;
    this.setState('seeking');
    const idx = this.nextIndex;
    await this.driver.applyTokenAnimated(
      this.tokens[idx],
      this.moveAnimationDurationMs / Math.max(0.1, this._speed),
    );
    if (this._state !== 'seeking') return; // seek/pause raced in
    this.nextIndex = idx + 1;
    this._positionMs = this.nextIndex * this.moveSpacingMs;
    this.onMove?.(idx, this.tokens.length);
    this.onPosition?.(this._positionMs, idx);
    this.setState(this.nextIndex >= this.tokens.length ? 'complete' : 'paused');
    if (this.nextIndex >= this.tokens.length) this.onComplete?.();
  }

  public async stepBackward(): Promise<void> {
    if (this.nextIndex <= 0) return;
    this.setState('seeking');
    const idx = this.nextIndex - 1;
    // O(1) undo: animate the INVERSE token (no reset flash, no re-apply).
    await this.driver.applyTokenAnimated(
      invertPyraminxToken(this.tokens[idx]),
      this.moveAnimationDurationMs / Math.max(0.1, this._speed),
    );
    if (this._state !== 'seeking') return;
    this.nextIndex = idx;
    this._positionMs = this.nextIndex * this.moveSpacingMs;
    this.onPosition?.(this._positionMs, this.nextIndex - 1);
    this.setState('paused');
  }

  public setSpeed(speed: number): void {
    this._speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  }

  public dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.onPosition = null;
    this.onMove = null;
    this.onComplete = null;
    this.onStateChange = null;
  }

  // ── Playback loop ──────────────────────────────────────────────────────

  private tick = async (): Promise<void> => {
    if (this._state !== 'playing') return;
    const pos = this.computePosition();

    // Apply every move whose slot boundary has passed, animating each turn.
    while (
      this.nextIndex < this.tokens.length &&
      (this.nextIndex + 1) * this.moveSpacingMs <= pos
    ) {
      const idx = this.nextIndex;
      const slot = this.moveSpacingMs;
      const animDuration = Math.min(
        this.moveAnimationDurationMs / Math.max(0.1, this._speed),
        (slot / Math.max(0.1, this._speed)) * 0.85,
      );
      await this.driver.applyTokenAnimated(this.tokens[idx], Math.max(1, animDuration));
      if (this._state !== 'playing') return; // paused / seeked mid-animation
      this.nextIndex = idx + 1;
      this._positionMs = this.nextIndex * this.moveSpacingMs;
      this.onMove?.(idx, this.tokens.length);
      this.onPosition?.(this._positionMs, idx);
    }

    if (this.nextIndex >= this.tokens.length) {
      this.rafId = null;
      this._positionMs = this._totalMs;
      this.onPosition?.(this._totalMs, this.tokens.length - 1);
      this.setState('complete');
      this.onComplete?.();
      return;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}
