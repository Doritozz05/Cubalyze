import { Subject, ReplaySubject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { SmartCubeAdapter } from '../interfaces/SmartCubeAdapter';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { connectGanCube, GanCubeConnection } from '@cubeforge/gan-protocol';

/**
 * Parses a move string like "U", "U'", "U2" into face + direction.
 * Returns null for unrecognised notation.
 */
function parseMoveNotation(move: string): { face: CubeFace; direction: CubeMoveDirection } | null {
  const match = move.match(/^([UDRLBF])([2']?)$/);
  if (!match) return null;

  const face = match[1] as CubeFace;
  let direction: CubeMoveDirection = 1; // clockwise by default
  if (match[2] === "'") direction = -1;
  else if (match[2] === '2') direction = 2;

  return { face, direction };
}

export class GanCubeAdapter implements SmartCubeAdapter {
  public readonly vendor = 'GAN';
  public readonly model = 'SmartCube'; 

  private connection: GanCubeConnection | null = null;
  private eventsSub: Subscription | null = null;

  private movesSubject = new ReplaySubject<CubeMoveEvent>(1);
  private batterySubject = new Subject<number>();
  private gyroSubject = new Subject<GyroEvent>();

  public moves$ = this.movesSubject.asObservable();
  public battery$ = this.batterySubject.asObservable();
  public gyro$ = this.gyroSubject.asObservable();

  /** Callback invoked when a FACELETS event arrives from the cube.
   *  Used by SyncBridge to snap the 3D scene to the physical cube state. */
  public onFacelets: ((facelets: string) => void) | null = null;

  async connect(manualMac?: string): Promise<void> {
    try {
      this.connection = await connectGanCube(async (device, isFallback) => {
        if (manualMac) return manualMac;
        
        if (isFallback) {
          // Instead of window.prompt which is blocked by Chrome after Bluetooth dialog,
          // we throw a specific error so the UI can ask for it.
          throw new Error('MAC_REQUIRED');
        }
        return null;
      });
    } catch (error) {
      console.error('Failed to connect GAN Cube:', error);
      throw error;
    }
    
    this.eventsSub?.unsubscribe();
    this.eventsSub = this.connection.events$.subscribe((evt) => {
      if (evt.type === 'DISCONNECT') {
        this.disconnect();
      } else if (evt.type === 'BATTERY') {
        this.batterySubject.next(evt.batteryLevel);
      } else if (evt.type === 'MOVE') {
        const hostNow = performance.now();
        const cubeTs = evt.cubeTimestamp ?? hostNow;
        
        // Parse notation string (e.g. "U", "U'", "U2") into face + direction
        const parsed = parseMoveNotation(evt.move);
        if (!parsed) return; // Skip unrecognized moves
        
        this.movesSubject.next({
          face: parsed.face,
          direction: parsed.direction,
          cubeTimestamp: cubeTs,
          hostTimestamp: hostNow
        });
      } else if (evt.type === 'FACELETS') {
        // Emit FACELETS as a synthetic CubeMoveEvent batch so SyncBridge
        // can snap the 3D scene to the cube's actual physical state.
        if (this.onFacelets) {
          this.onFacelets(evt.facelets);
        }
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

  /** Request the cube to send its current facelet state.
   *  The result will arrive as a FACELETS event and trigger onFacelets. */
  public async requestFacelets(): Promise<void> {
    if (this.connection) {
      await this.connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
    }
  }

  async disconnect(): Promise<void> {
    this.eventsSub?.unsubscribe();
    this.eventsSub = null;
    this.movesSubject.complete();
    this.batterySubject.complete();
    this.gyroSubject.complete();
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
  }
}
