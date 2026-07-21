import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { SmartCubeAdapter } from '../interfaces/SmartCubeAdapter';
import { ClockDriftReconciler } from '../sync/ClockDrift';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { connectGanCube, reconnectGanCube, type GanCubeConnection, type BluetoothDeviceWithMAC } from '@cubeforge/gan-protocol';

function parseMoveNotation(move: string): { face: CubeFace; direction: CubeMoveDirection } | null {
  const match = move.match(/^([UDRLBF])(2|'|2')?$/);
  if (!match) return null;

  const face = match[1] as CubeFace;
  let direction: CubeMoveDirection = 1;
  if (match[2] === "'" || match[2] === "2'") direction = -1;
  else if (match[2] === '2') direction = 2;

  return { face, direction };
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

export class GanCubeAdapter implements SmartCubeAdapter {
  public readonly vendor = 'GAN';
  public model = 'SmartCube';
  /** Whether the connected cube has gyro/IMU support. Set from HARDWARE event. */
  public gyroSupported = false;

  public onConnectionChange: ((status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void) | null = null;

  /**
   * Callback fired when a HARDWARE event is received from the cube.
   * Carries the detected model name and gyro support flag so upstream
   * consumers (orientation store, UI) can react without needing the 3D panel.
   */
  public onHardwareInfo: ((info: { model: string; gyroSupported: boolean }) => void) | null = null;

  public get isConnected(): boolean {
    return this.connection !== null;
  }

  private connection: GanCubeConnection | null = null;
  private eventsSub: Subscription | null = null;

  // Stable subjects — NEVER recreated. Survives disconnect/reconnect.
  // Existing subscribers keep receiving events after reconnection.
  private movesSubject = new ReplaySubject<CubeMoveEvent>(1);
  private faceletsSubject = new ReplaySubject<string>(1);
  private batterySubject = new Subject<number>();
  private gyroSubject = new Subject<GyroEvent>();
  private invalidMovesSubject = new Subject<string>();
  private connectionStatusSubject = new BehaviorSubject<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  public moves$ = this.movesSubject.asObservable();
  public facelets$ = this.faceletsSubject.asObservable();
  public battery$ = this.batterySubject.asObservable();
  public gyro$ = this.gyroSubject.asObservable();
  public invalidMoves$ = this.invalidMovesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  public onFacelets: ((facelets: string) => void) | null = null;
  private clockReconciler = new ClockDriftReconciler();

  // ── BLE reconnection state ──────────────────────────────────────────────────
  private device: BluetoothDeviceWithMAC | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isUserDisconnect = false;
  private manualMac: string | undefined;

  async connect(manualMac?: string): Promise<void> {
    this.manualMac = manualMac;
    this.isUserDisconnect = false;

    try {
      this.connection = await connectGanCube(async (device, isFallback) => {
        this.device = device;
        if (manualMac) return manualMac;
        if (isFallback) {
          throw new Error('Bluetooth address selection failed — manual MAC required');
        }
        return null;
      });
    } catch (error) {
      this.device = null;
      this.onConnectionChange?.('disconnected');
      this.connectionStatusSubject.next('disconnected');
      throw error;
    }

    this.reconnectAttempts = 0;
    this.setupEventsSubscription();
    // Request hardware info to populate model name and gyroSupported flag, and request battery level
    this.requestHardware().catch(() => {});
    this.requestBattery().catch(() => {});
    this.onConnectionChange?.('connected');
    this.connectionStatusSubject.next('connected');
  }

  // Track whether a REQUEST_FACELETS is already in-flight to
  // deduplicate concurrent calls. Multiple subscribers (validator,
  // connect flow, Cube3DPanel) may trigger requestFacelets simultaneously
  // — only the first call issues the GATT command; subsequent calls wait
  // for the same promise. The GATT queue in GanCubeClassicConnection
  // serialises the actual writeValue calls.
  private faceletsRequestPromise: Promise<void> | null = null;
  private hardwareRequestPromise: Promise<void> | null = null;
  private batteryRequestPromise: Promise<void> | null = null;

  public async requestFacelets(): Promise<void> {
    if (!this.connection) return;
    // Dedup: reuse the in-flight promise instead of issuing a new command
    if (this.faceletsRequestPromise) return this.faceletsRequestPromise;
    this.faceletsRequestPromise = this.connection.sendCubeCommand({ type: "REQUEST_FACELETS" })
      .finally(() => { this.faceletsRequestPromise = null; });
    return this.faceletsRequestPromise;
  }

  /**
   * Request hardware info from the cube (model name, gyro support, firmware versions).
   * The HARDWARE event response will update `this.model` and `this.gyroSupported`.
   */
  public async requestHardware(): Promise<void> {
    if (!this.connection) return;
    // Dedup: reuse the in-flight promise
    if (this.hardwareRequestPromise) return this.hardwareRequestPromise;
    this.hardwareRequestPromise = this.connection.sendCubeCommand({ type: "REQUEST_HARDWARE" })
      .finally(() => { this.hardwareRequestPromise = null; });
    return this.hardwareRequestPromise;
  }

  /**
   * Request battery level from the cube.
   * The BATTERY event response will emit to `battery$`.
   */
  public async requestBattery(): Promise<void> {
    if (!this.connection) return;
    if (this.batteryRequestPromise) return this.batteryRequestPromise;
    this.batteryRequestPromise = this.connection.sendCubeCommand({ type: "REQUEST_BATTERY" })
      .finally(() => { this.batteryRequestPromise = null; });
    return this.batteryRequestPromise;
  }

  async disconnect(): Promise<void> {
    this.isUserDisconnect = true;
    this.cancelReconnect();
    this.teardownEventsSubscription();
    // Subjects are NEVER completed — they stay alive for potential reconnection.
    // Existing subscribers keep working after reconnect.
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
    this.device = null;
    this.onConnectionChange?.('disconnected');
    this.connectionStatusSubject.next('disconnected');
  }

  // ── Private: events subscription ────────────────────────────────────────────

  private setupEventsSubscription(): void {
    this.eventsSub?.unsubscribe();
    // Reset clock drift reconciler on (re)connect — cube clock may have reset
    this.clockReconciler = new ClockDriftReconciler();
    this.eventsSub = this.connection!.events$.subscribe((evt) => {
      if (evt.type === 'DISCONNECT') {
        this.handleDisconnect();
      } else if (evt.type === 'BATTERY') {
        this.batterySubject.next(evt.batteryLevel);
      } else if (evt.type === 'MOVE') {
        this.handleMove(evt);
      } else if (evt.type === 'FACELETS') {
        // Simple validation: a standard 3x3 facelet string is 54 characters
        if (typeof evt.facelets === 'string' && evt.facelets.length === 54) {
          this.faceletsSubject.next(evt.facelets);
          this.onFacelets?.(evt.facelets); // backward compat
        } else {
          console.warn('[GanCubeAdapter] Invalid FACELETS state received:', evt.facelets);
        }
      } else if (evt.type === 'GYRO') {
        this.handleGyro(evt);
      } else if (evt.type === 'HARDWARE') {
        if (evt.hardwareName) {
          this.model = evt.hardwareName;
        }
        if (typeof evt.gyroSupported === 'boolean') {
          this.gyroSupported = evt.gyroSupported;
        }
        // Notify upstream consumers (e.g. orientation store) immediately
        // so the UI shows correct gyro status without needing the 3D panel.
        if (typeof evt.gyroSupported === 'boolean' || evt.hardwareName) {
          this.onHardwareInfo?.({
            model: this.model,
            gyroSupported: this.gyroSupported,
          });
        }
      }
    });
  }

  private teardownEventsSubscription(): void {
    this.eventsSub?.unsubscribe();
    this.eventsSub = null;
  }

  // ── Private: event handlers ─────────────────────────────────────────────────

  private handleMove(evt: { move: string; cubeTimestamp: number | null }): void {
    const hostNow = performance.now();
    const cubeTs = evt.cubeTimestamp ?? hostNow;

    if (evt.cubeTimestamp != null) {
      this.clockReconciler.addDataPoint(evt.cubeTimestamp, hostNow);
    }
    const correctedHostTs = evt.cubeTimestamp != null ? this.clockReconciler.reconcile(evt.cubeTimestamp) : hostNow;

    const parsed = parseMoveNotation(evt.move);
    if (!parsed) {
      console.warn('[GanCubeAdapter] Unrecognized move:', evt.move);
      this.invalidMovesSubject.next(evt.move);
      return;
    }

    this.movesSubject.next({
      face: parsed.face,
      direction: parsed.direction,
      cubeTimestamp: cubeTs,
      hostTimestamp: correctedHostTs,
    });
  }

  private handleGyro(evt: { quaternion?: { x: number; y: number; z: number; w: number }; velocity?: { x: number; y: number; z: number } }): void {
    if (evt.quaternion) {
      const gyroEvent: GyroEvent = {
        x: evt.quaternion.x,
        y: evt.quaternion.y,
        z: evt.quaternion.z,
        w: evt.quaternion.w,
      };
      if (evt.velocity) {
        gyroEvent.velocity = {
          x: evt.velocity.x,
          y: evt.velocity.y,
          z: evt.velocity.z,
        };
      }
      this.gyroSubject.next(gyroEvent);
    }
  }

  private handleDisconnect(): void {
    this.teardownEventsSubscription();
    // Subjects are NEVER replaced — existing subscribers continue to work.
    // New events from reconnection flow through the same subjects.

    if (!this.isUserDisconnect && this.device) {
      this.attemptReconnect();
    } else {
      this.onConnectionChange?.('disconnected');
      this.connectionStatusSubject.next('disconnected');
    }
  }

  // ── Private: reconnection logic ─────────────────────────────────────────────

  private attemptReconnect(): void {
    // Guard: skip if already reconnecting or already connected
    if (this.reconnectTimer !== null || this.connection !== null) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts = 0;
      this.device = null;
      this.onConnectionChange?.('disconnected');
      this.connectionStatusSubject.next('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.onConnectionChange?.('reconnecting');
    this.connectionStatusSubject.next('reconnecting');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        if (!this.device) throw new Error('No device reference for reconnection');
        // reconnectGanCube does a single GATT connect — no picker dialog, no double connect
        this.connection = await reconnectGanCube(this.device);
        this.reconnectAttempts = 0;
        this.setupEventsSubscription();
        // Request hardware info to populate model name and gyroSupported flag
        this.requestHardware().catch(() => {});
        this.onConnectionChange?.('connected');
        this.connectionStatusSubject.next('connected');
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}
