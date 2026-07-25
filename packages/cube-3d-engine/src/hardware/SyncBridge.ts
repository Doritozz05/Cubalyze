import { Subscription } from 'rxjs';
import type { Observable } from 'rxjs';
import type * as Comlink from 'comlink';
import type { EngineWorkerAPI } from '../workers/EngineWorker';
import type { CubeMoveEvent, GyroEvent, CubeFace } from '@cubeforge/types';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import type { RotationAxis } from '../animation/RotationEngine';
import type { EasingStrategy } from '../animation/Easing';

interface QueuedRotation {
  axis: RotationAxis;
  layerValues: number[];
  angle: number;
  durationMs: number;
  hostTimestamp: number;
  easingStrategy: EasingStrategy;
}

// ─── Velocity Tracker ─────────────────────────────────────────────────────
// Tracks the user's turn speed (TPS) via exponential moving average
// to adapt animation parameters dynamically.

class VelocityTracker {
  private lastMoveTime = 0;
  private emaIntervalMs = 200; // EMA smoothing: higher = slower to adapt
  private _recentTps = 4;       // Default: 4 TPS (moderate pace)

  /** Record a move timestamp and update the TPS estimate. */
  recordMove(timestampMs: number): void {
    if (this.lastMoveTime > 0) {
      const interval = Math.max(1, timestampMs - this.lastMoveTime);
      const instantTps = 1000 / interval;
      // Exponential moving average
      const alpha = Math.min(1, interval / this.emaIntervalMs);
      this._recentTps = this._recentTps * (1 - alpha) + instantTps * alpha;
    }
    this.lastMoveTime = timestampMs;
  }

  /** Current smoothed TPS estimate. */
  get tps(): number {
    return this._recentTps;
  }

  reset(): void {
    this.lastMoveTime = 0;
    this._recentTps = 4;
  }
}

export class SyncBridge {
  private workerProxy: Comlink.Remote<EngineWorkerAPI>;
  private subs: Subscription[] = [];

  private moveBuffer: QueuedRotation[] = [];
  private coalesceBuffer: CubeMoveEvent[] = [];
  private coalesceTimeout: ReturnType<typeof setTimeout> | null = null;

  private velocity = new VelocityTracker();

  // ─── Adaptive thresholds ─────────────────────────────────────────────

  /** Base animation duration for a single move at moderate TPS (ms). */
  private static BASE_DURATION_MS = 100;

  /** Minimum animation duration (ms) — below this, the move is essentially instant. */
  private static MIN_DURATION_MS = 10;

  /** Queue length at which we enter catch-up mode (faster easing, shorter coalesce). */
  private static CATCHUP_QUEUE_THRESHOLD = 5;

  /** Normal coalesce window for M-move detection (ms). */
  private static NORMAL_COALESCE_MS = 35;

  /** Catch-up coalesce window (ms) — shorter when we're behind. */
  private static CATCHUP_COALESCE_MS = 12;

  /** Queue length at which easing switches from bounce to smooth. */
  private static SMOOTH_EASING_QUEUE_THRESHOLD = 2;

  /** Queue length at which easing switches to fast (no bounce, aggressive decel). */
  private static FAST_EASING_QUEUE_THRESHOLD = 5;

  constructor(workerProxy: Comlink.Remote<EngineWorkerAPI>) {
    this.workerProxy = workerProxy;
  }

  public bindCube(
    moves$: Observable<CubeMoveEvent>,
    gyro$?: Observable<GyroEvent>
  ): void {
    this.unbind();

    this.subs.push(
      moves$.subscribe((move: CubeMoveEvent) => {
        this.enqueueMove(move);
      })
    );

    if (gyro$) {
      this.subs.push(
        gyro$.subscribe((gyro: GyroEvent) => {
          this.workerProxy.updateGyro(gyro.x, gyro.y, gyro.z, gyro.w);
        })
      );
    }
  }

  // ─── Move Enqueueing ──────────────────────────────────────────────────

  private enqueueMove(move: CubeMoveEvent): void {
    // Track velocity for adaptive behavior
    this.velocity.recordMove(move.hostTimestamp);

    this.coalesceBuffer.push(move);

    if (this.coalesceTimeout) {
      clearTimeout(this.coalesceTimeout);
    }

    // Dynamic coalesce window: shorter when we're behind
    const queueSize = this.moveBuffer.length + this.coalesceBuffer.length;
    const windowMs = queueSize >= SyncBridge.CATCHUP_QUEUE_THRESHOLD
      ? SyncBridge.CATCHUP_COALESCE_MS
      : SyncBridge.NORMAL_COALESCE_MS;

    this.coalesceTimeout = setTimeout(() => {
      this.flushCoalesceBuffer();
    }, windowMs);
  }

  // ─── Coalesce Buffer Flush ────────────────────────────────────────────

  private flushCoalesceBuffer(): void {
    if (this.coalesceBuffer.length === 0) return;

    const queueSize = this.moveBuffer.length + this.coalesceBuffer.length;

    // Check for M move coalesce (L' and R or R' and L).
    for (let i = 0; i < this.coalesceBuffer.length - 1; i++) {
      const m1 = this.coalesceBuffer[i];
      const m2 = this.coalesceBuffer[i + 1];

      const map1 = FACE_ROTATION_MAP[m1.face as CubeFace];
      const map2 = FACE_ROTATION_MAP[m2.face as CubeFace];

      if (map1 && map2 && map1.axis === map2.axis && map1.layerValue !== map2.layerValue) {
        const angle1 = m1.direction * map1.angleSign * 90;
        const angle2 = m2.direction * map2.angleSign * 90;

        if (angle1 === angle2) {
          // Slice move detected — animate as single rotation
          const durationMs = this.computeDuration(queueSize);
          const easing = this.computeEasing(queueSize);

          this.moveBuffer.push({
            axis: map1.axis,
            layerValues: [map1.layerValue, map2.layerValue],
            angle: angle1,
            durationMs,
            hostTimestamp: Math.max(m1.hostTimestamp, m2.hostTimestamp),
            easingStrategy: easing,
          });

          this.coalesceBuffer.splice(i, 2);
          i--;
        }
      }
    }

    // Process remaining moves normally
    while (this.coalesceBuffer.length > 0) {
      const move = this.coalesceBuffer.shift()!;
      const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
      if (!mapping) continue;

      const angle = move.direction * mapping.angleSign * 90;
      const currentQueue = this.moveBuffer.length;
      const durationMs = this.computeDuration(currentQueue);
      const easing = this.computeEasing(currentQueue);

      this.moveBuffer.push({
        axis: mapping.axis,
        layerValues: [mapping.layerValue],
        angle,
        durationMs,
        hostTimestamp: move.hostTimestamp,
        easingStrategy: easing,
      });
    }

    this.processQueue();
  }

  // ─── Adaptive Duration ────────────────────────────────────────────────

  /**
   * Computes animation duration based on queue pressure.
   *
   * Strategy: exponential decay so duration drops fast when queue builds up.
   * At queue=0: ~100ms (bouncy, premium feel)
   * At queue=3: ~42ms (smooth, responsive)
   * At queue=6: ~18ms (fast, barely visible)
   * At queue=10+: bottoms at MIN_DURATION_MS
   */
  private computeDuration(queueLength: number): number {
    const decay = Math.pow(0.65, queueLength);
    return Math.max(
      SyncBridge.MIN_DURATION_MS,
      Math.round(SyncBridge.BASE_DURATION_MS * decay)
    );
  }

  // ─── Adaptive Easing ──────────────────────────────────────────────────

  /**
   * Selects easing strategy based on queue pressure.
   *
   * - queue ≤ 2: 'bounce' — premium overshoot feel
   * - queue ≤ 5: 'smooth' — fast start, smooth finish, no bounce
   * - queue > 5:  'fast'   — aggressive deceleration, catch-up mode
   */
  private computeEasing(queueLength: number): EasingStrategy {
    if (queueLength >= SyncBridge.FAST_EASING_QUEUE_THRESHOLD) {
      return 'fast';
    }
    if (queueLength >= SyncBridge.SMOOTH_EASING_QUEUE_THRESHOLD) {
      return 'smooth';
    }
    return 'bounce';
  }

  // ─── Queue Processing (NON-BLOCKING) ──────────────────────────────────

  /**
   * Drains the move buffer by firing ALL moves to the RotationEngine
   * as fast as possible. The RotationEngine's pool (6 pivot tasks) and
   * collision detection handle concurrency and intersection naturally.
   *
   * This is the critical fix: we do NOT await each rotation. Instead,
   * we fire-and-forget, letting the engine's internal task pool handle
   * overlapping and intersecting rotations.
   */
  private processQueue(): void {
    let i = 0;
    while (this.moveBuffer.length > 0) {
      const task = this.moveBuffer.shift()!;
      const elapsedMs = Math.max(0, performance.now() - task.hostTimestamp);

      // Fire all moves to the engine without awaiting.
      // The RotationEngine has 6 concurrent pivot slots and collision
      // detection — it will snap overlapping moves and run independent
      // ones in parallel.
      this.workerProxy.rotateLayers(
        task.axis,
        task.layerValues,
        task.angle,
        task.durationMs,
        elapsedMs,
        task.easingStrategy,
      ).catch(console.error);

      i++;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  public get pendingMoves(): number {
    return this.moveBuffer.length + this.coalesceBuffer.length;
  }

  /**
   * Discard all buffered moves without processing them.
   * Used after a facelets sync to clear stale moves replayed by the
   * ReplaySubject buffer (which would otherwise animate on top of the
   * freshly-synced state and cause a visual desync).
   */
  public clearPendingMoves(): void {
    if (this.coalesceTimeout) {
      clearTimeout(this.coalesceTimeout);
      this.coalesceTimeout = null;
    }
    this.coalesceBuffer = [];
    this.moveBuffer = [];
  }

  public async syncState(moves: CubeMoveEvent[]): Promise<void> {
    for (const move of moves) {
      const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
      if (!mapping) continue;
      const angle = move.direction * mapping.angleSign * 90;
      await this.workerProxy.rotateLayers(mapping.axis, [mapping.layerValue], angle, 0, 0, 'linear');
    }
  }

  public unbind(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
    if (this.coalesceTimeout) {
      clearTimeout(this.coalesceTimeout);
      this.coalesceTimeout = null;
    }
    this.coalesceBuffer = [];
    this.moveBuffer = [];
    this.velocity.reset();
    this.workerProxy.disableGyro();
  }
}
