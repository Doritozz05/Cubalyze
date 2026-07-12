import { Subscription } from 'rxjs';
import type { Observable } from 'rxjs';
import type * as Comlink from 'comlink';
import type { EngineWorkerAPI } from '../workers/EngineWorker';
import type { CubeMoveEvent, GyroEvent, CubeFace } from '@cubeforge/types';
import { FACE_ROTATION_MAP } from '@cubeforge/types';

/**
 * Bridges hardware cube events (from the HAL layer) to the 3D rendering engine.
 *
 * Translates CubeMoveEvents (face + direction) into 3D rotation commands
 * (axis + layerValue + angle) using the canonical FACE_ROTATION_MAP from
 * @cubeforge/types — eliminating the duplicate switch statement that
 * previously existed here.
 */
export class SyncBridge {
  private workerProxy: Comlink.Remote<EngineWorkerAPI>;
  private subs: Subscription[] = [];

  constructor(workerProxy: Comlink.Remote<EngineWorkerAPI>) {
    this.workerProxy = workerProxy;
  }

  /**
   * Subscribes to a smart cube's move and gyroscope streams.
   * Automatically unbinds any previous subscriptions before binding new ones.
   */
  public bindCube(
    moves$: Observable<CubeMoveEvent>,
    gyro$?: Observable<GyroEvent>
  ): void {
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
    const durationMs = 150; // Default animation time per TDD-0006

    const mapping = FACE_ROTATION_MAP[move.face as CubeFace];
    if (!mapping) return; // Ignore unknown faces

    // Calculate rotation angle:
    // direction (1, -1, or 2) × angleSign from the mapping × 90°
    // For half-turns (direction=2), angle = ±180°
    const angle = move.direction * mapping.angleSign * 90;

    await this.workerProxy.rotateLayer(mapping.axis, mapping.layerValue, angle, durationMs);
  }

  public unbind(): void {
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }
}
