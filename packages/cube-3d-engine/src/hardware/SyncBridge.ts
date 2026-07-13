import { Subscription } from 'rxjs';
import type { Observable } from 'rxjs';
import type * as Comlink from 'comlink';
import type { EngineWorkerAPI } from '../workers/EngineWorker';
import type { CubeMoveEvent, GyroEvent, CubeFace } from '@cubeforge/types';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import type { RotationAxis } from '../animation/RotationEngine';

interface QueuedRotation {
  axis: RotationAxis;
  layerValue: number;
  angle: number;
  durationMs: number;
}

export class SyncBridge {
  private workerProxy: Comlink.Remote<EngineWorkerAPI>;
  private subs: Subscription[] = [];

  private moveBuffer: QueuedRotation[] = [];
  private isProcessing = false;

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
    // Dynamic rotation speed to catch up if moves pile up
    const baseDuration = 90;
    const durationMs = Math.max(20, baseDuration - (this.moveBuffer.length * 15));
    
    const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
    if (!mapping) return;

    const angle = move.direction * mapping.angleSign * 90;

    this.moveBuffer.push({
      axis: mapping.axis,
      layerValue: mapping.layerValue,
      angle,
      durationMs,
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.moveBuffer.length > 0) {
      const task = this.moveBuffer.shift()!;
      await this.workerProxy.rotateLayer(task.axis, task.layerValue, task.angle, task.durationMs);
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
      await this.workerProxy.rotateLayer(mapping.axis, mapping.layerValue, angle, 0);
    }
  }

  public unbind(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
    this.workerProxy.disableGyro();
  }
}

