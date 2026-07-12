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
    try {
      this.connection = await connectGanCube(async (device, isFallback) => {
        if (isFallback) {
          const isSupported = typeof device.watchAdvertisements === 'function';
          
          let instructions = 'chrome://flags/#enable-experimental-web-platform-features\nand set it to "Enabled".';
          const ua = navigator.userAgent;
          if (/iPhone|iPad|iPod/i.test(ua)) {
            instructions = 'Turn on "Enable BLE Advertisements" in Bluefy browser settings.';
          } else if (/Edg\//i.test(ua)) {
            instructions = 'edge://flags/#enable-experimental-web-platform-features\nand set it to "Enabled".';
          }
          
          const msg = isSupported 
            ? 'Could not auto-detect MAC Address.\nPlease enter your GAN Cube MAC address (e.g., AA:BB:CC:DD:EE:FF):'
            : `Your browser blocks automatic MAC reading.\nFor automatic connection, copy & paste this in a new tab:\n\n${instructions}\n\nOr manually enter your cube's MAC address here:`;
          
          const mac = prompt(msg);
          return mac || null;
        }
        return null;
      });
    } catch (error) {
      console.error('Failed to connect GAN Cube:', error);
      throw error;
    }
    
    this.connection.events$.subscribe((evt) => {
      if (evt.type === 'DISCONNECT') {
        this.disconnect();
      } else if (evt.type === 'BATTERY') {
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
        if (evt.quaternion) {
          this.gyroSubject.next({
            x: evt.quaternion.x,
            y: evt.quaternion.y,
            z: evt.quaternion.z,
            w: evt.quaternion.w
          });
        }
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
