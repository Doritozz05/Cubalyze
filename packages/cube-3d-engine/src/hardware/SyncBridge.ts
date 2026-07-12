import { Subscription } from 'rxjs';
import type * as Comlink from 'comlink';
import type { EngineWorkerAPI } from '../workers/EngineWorker';

export interface CubeMoveEvent {
  face: string; // 'U', 'R', etc.
  direction: number; // 1 (cw), -1 (ccw), 2 (double)
}

export interface GyroEvent {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class SyncBridge {
  private workerProxy: Comlink.Remote<EngineWorkerAPI>;
  private subs: Subscription[] = [];

  constructor(workerProxy: Comlink.Remote<EngineWorkerAPI>) {
    this.workerProxy = workerProxy;
  }

  public bindCube(moves$: any, gyro$: any): void {
    this.unbind();

    this.subs.push(
      moves$.subscribe((move: CubeMoveEvent) => {
        this.applyMove(move);
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

  private async applyMove(move: CubeMoveEvent): Promise<void> {
    const durationMs = 150; // default animation time
    let axis: 'x' | 'y' | 'z';
    let layerValue: number;
    let angle = move.direction * -90;

    switch (move.face) {
      case 'U': axis = 'y'; layerValue = 1; angle = move.direction * -90; break;
      case 'D': axis = 'y'; layerValue = -1; angle = move.direction * 90; break;
      case 'R': axis = 'x'; layerValue = 1; angle = move.direction * -90; break;
      case 'L': axis = 'x'; layerValue = -1; angle = move.direction * 90; break;
      case 'F': axis = 'z'; layerValue = 1; angle = move.direction * -90; break;
      case 'B': axis = 'z'; layerValue = -1; angle = move.direction * 90; break;
      default: return; // ignore unknown
    }

    await this.workerProxy.rotateLayer(axis, layerValue, angle, durationMs);
  }

  public unbind(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }
}
