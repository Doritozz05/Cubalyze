import { Observable } from 'rxjs';

export interface GyroEvent {
  x: number;
  y: number;
  z: number;
  w?: number; // Quaternion
}

export interface CubeMoveEvent {
  face: string;           // "U", "R'", "F2"
  cubeTimestamp: number;  // Internal time from cube (can have drift)
  hostTimestamp: number;  // Browser's performance.now()
}

export interface SmartCubeAdapter {
  readonly vendor: string;
  readonly model: string;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  moves$: Observable<CubeMoveEvent>;
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
}
