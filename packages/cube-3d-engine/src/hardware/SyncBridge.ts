import { Subscription } from 'rxjs';
import type { Observable } from 'rxjs';
import type * as Comlink from 'comlink';
import type { EngineWorkerAPI } from '../workers/EngineWorker';
import type { CubeMoveEvent, GyroEvent, CubeFace } from '@cubeforge/types';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import type { RotationAxis } from '../animation/RotationEngine';

interface QueuedRotation {
  axis: RotationAxis;
  layerValues: number[];
  angle: number;
  durationMs: number;
  hostTimestamp: number;
}

export class SyncBridge {
  private workerProxy: Comlink.Remote<EngineWorkerAPI>;
  private subs: Subscription[] = [];

  private moveBuffer: QueuedRotation[] = [];
  private isProcessing = false;

  private coalesceBuffer: CubeMoveEvent[] = [];
  private coalesceTimeout: ReturnType<typeof setTimeout> | null = null;

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

  private enqueueMove(move: CubeMoveEvent): void {
    this.coalesceBuffer.push(move);

    if (this.coalesceTimeout) {
      clearTimeout(this.coalesceTimeout);
    }

    this.coalesceTimeout = setTimeout(() => {
      this.flushCoalesceBuffer();
    }, 45); // 45ms window to catch simultaneous M moves (L' and R)
  }

  private flushCoalesceBuffer(): void {
    if (this.coalesceBuffer.length === 0) return;

    // Check for M move coalesce (L' and R or R' and L)
    // For simplicity, we just look at the first two moves. If they form an M slice move, we merge them.
    if (this.coalesceBuffer.length >= 2) {
      const m1 = this.coalesceBuffer[0];
      const m2 = this.coalesceBuffer[1];
      
      const map1 = FACE_ROTATION_MAP[m1.face as CubeFace];
      const map2 = FACE_ROTATION_MAP[m2.face as CubeFace];

      if (map1 && map2 && map1.axis === map2.axis && map1.layerValue !== map2.layerValue) {
        const angle1 = m1.direction * map1.angleSign * 90;
        const angle2 = m2.direction * map2.angleSign * 90;

        if (angle1 === angle2) {
          // They match! It's a slice move (or simultaneous outer layers)
          const baseDuration = 120;
          const durationMs = Math.max(20, baseDuration - (this.moveBuffer.length * 15));
          
          this.moveBuffer.push({
            axis: map1.axis,
            layerValues: [map1.layerValue, map2.layerValue],
            angle: angle1,
            durationMs,
            hostTimestamp: Math.max(m1.hostTimestamp, m2.hostTimestamp),
          });

          this.coalesceBuffer.splice(0, 2);
        }
      }
    }

    // Process any remaining moves normally
    while (this.coalesceBuffer.length > 0) {
      const move = this.coalesceBuffer.shift()!;
      const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
      if (!mapping) continue;

      const angle = move.direction * mapping.angleSign * 90;
      const baseDuration = 90;
      const durationMs = Math.max(20, baseDuration - (this.moveBuffer.length * 15));

      this.moveBuffer.push({
        axis: mapping.axis,
        layerValues: [mapping.layerValue],
        angle,
        durationMs,
        hostTimestamp: move.hostTimestamp,
      });
    }

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.moveBuffer.length > 0) {
      const task = this.moveBuffer.shift()!;
      const elapsedMs = Math.max(0, performance.now() - task.hostTimestamp);
      // Fire and forget: RotationEngine handles its own internal concurrency/snapping
      this.workerProxy.rotateLayers(task.axis, task.layerValues, task.angle, task.durationMs, elapsedMs).catch(console.error);
    }

    this.isProcessing = false;
  }

  public get pendingMoves(): number {
    return this.moveBuffer.length;
  }

  public async syncState(moves: CubeMoveEvent[]): Promise<void> {
    for (const move of moves) {
      const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
      if (!mapping) continue;
      const angle = move.direction * mapping.angleSign * 90;
      await this.workerProxy.rotateLayers(mapping.axis, [mapping.layerValue], angle, 0);
    }
  }

  public unbind(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
    this.workerProxy.disableGyro();
  }
}

