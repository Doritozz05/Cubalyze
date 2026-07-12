import { Observable } from 'rxjs';
import type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

// Re-export from @cubeforge/types so consumers can import from either place
export type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

export interface SmartCubeAdapter {
  readonly vendor: string;
  readonly model: string;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  moves$: Observable<CubeMoveEvent>;
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
}
