import { Observable, Subject } from 'rxjs';
import { SmartCubeAdapter, CubeMoveEvent, GyroEvent } from '../interfaces/SmartCubeAdapter';
import { connectGanCube, GanCubeConnection } from '@cubeforge/gan-protocol';
import { ClockDriftReconciler } from '../sync/ClockDrift';

export class GanCubeAdapter implements SmartCubeAdapter {
  public readonly vendor = 'GAN';
  public readonly model = 'SmartCube'; 

  private connection: GanCubeConnection | null = null;
  private reconciler: ClockDriftReconciler;

  private movesSubject = new Subject<CubeMoveEvent>();
  private batterySubject = new Subject<number>();
  private gyroSubject = new Subject<GyroEvent>();

  public moves$ = this.movesSubject.asObservable();
  public battery$ = this.batterySubject.asObservable();
  public gyro$ = this.gyroSubject.asObservable();

  constructor() {
    this.reconciler = new ClockDriftReconciler();
  }

  async connect(): Promise<void> {
    this.connection = await connectGanCube();
    
    this.connection.events$.subscribe((evt) => {
      if (evt.type === 'BATTERY') {
        this.batterySubject.next(evt.batteryLevel);
      } else if (evt.type === 'MOVE') {
        const hostNow = performance.now();
        const cubeTs = evt.cubeTimestamp ?? hostNow;
        this.reconciler.addDataPoint(cubeTs, hostNow);
        
        this.movesSubject.next({
          face: evt.move,
          cubeTimestamp: cubeTs,
          hostTimestamp: this.reconciler.reconcile(cubeTs)
        });
      } else if (evt.type === 'GYRO') {
        this.gyroSubject.next({
          x: evt.quaternion.x,
          y: evt.quaternion.y,
          z: evt.quaternion.z,
          w: evt.quaternion.w
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
  }
}
