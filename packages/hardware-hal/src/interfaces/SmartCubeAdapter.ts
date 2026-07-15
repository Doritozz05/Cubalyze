import { Observable } from 'rxjs';
import type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

export type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

export interface SmartCubeAdapter {
  readonly vendor: string;
  model: string;

  connect(manualMac?: string): Promise<void>;
  disconnect(): Promise<void>;

  moves$: Observable<CubeMoveEvent>;
  facelets$: Observable<string>;
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
}
