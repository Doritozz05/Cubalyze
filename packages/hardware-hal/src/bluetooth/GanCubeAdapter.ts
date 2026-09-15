import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';
import type { Subscription } from 'rxjs';
import { SmartCubeAdapter, type CubeIdentity } from '../interfaces/SmartCubeAdapter';
import { ClockDriftReconciler } from '../sync/ClockDrift';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubalyze/types';
import { connectGanCube, reconnectGanCube, type GanCubeConnection, type BluetoothDeviceWithMAC, type GanCubeEvent } from '@cubalyze/gan-protocol';

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

  // ── Hardware identity ───────────────────────────────────────────────────
  //
  // The HARDWARE response carries the model name, the firmware and the
  // production date, and the connection carries the address. Only the model and
  // the gyro flag used to be kept, so the rest of the app could not answer "which
  // cube is this?" — which is what the per-cube attribution needs. They are
  // kept here and published as one object, because they arrive in two beats:
  // the address at connect, the rest when the cube answers.
  private hardwareName: string | null = null;
  private hardwareVersion: string | null = null;
  private softwareVersion: string | null = null;
  private productDate: string | null = null;
  /** Whether the cube has actually answered the hardware request yet. */
  private gyroReported = false;
  private currentIdentity: CubeIdentity | null = null;
  private identitySubject = new ReplaySubject<CubeIdentity | null>(1);

  /** Who the connected cube is, re-emitted as the handshake fills it in. */
  public identity$ = this.identitySubject.asObservable();

  constructor() {
    // Nothing is connected at boot: subscribers get the honest answer straight
    // away instead of waiting for a first cube that may never come.
    this.identitySubject.next(null);
  }

  /** The connected cube's identity right now, or null when there is none. */
  public get identity(): CubeIdentity | null {
    return this.currentIdentity;
  }

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

  /**
   * Build the identity from whatever the handshake has produced so far and
   * publish it. Called at connect, on every HARDWARE answer and on (real)
   * disconnect, so subscribers always hold the current truth.
   */
  private publishIdentity(): void {
    if (!this.connection) {
      this.currentIdentity = null;
      this.identitySubject.next(null);
      return;
    }
    this.currentIdentity = {
      vendor: this.vendor,
      model: this.hardwareName,
      mac: this.device?.mac || null,
      hardwareVersion: this.hardwareVersion,
      softwareVersion: this.softwareVersion,
      productDate: this.productDate,
      // `false` before the cube answers would be a claim, not a fact.
      gyroSupported: this.gyroReported ? this.gyroSupported : null,
    };
    this.identitySubject.next(this.currentIdentity);
  }

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

    // A new connection may be a DIFFERENT cube, so nothing learned from the
    // previous one may survive: otherwise the first thing the UI says about the
    // new cube would be the old cube's name.
    this.hardwareName = null;
    this.hardwareVersion = null;
    this.softwareVersion = null;
    this.productDate = null;
    this.gyroReported = false;
    this.gyroSupported = false;
    this.model = 'SmartCube';

    try {
      this.connection = await connectGanCube(async (device: BluetoothDeviceWithMAC, isFallback?: boolean) => {
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
    // Seed the protocol driver's serial tracker: the GAN driver DISCARDS
    // every MOVE until the first FACELETS event arrives (its lastSerial
    // starts at -1). Requesting facelets right after connect closes that
    // window, so the first moves are never dropped.
    this.requestFacelets().catch(() => {});
    // The address is known as soon as the connection is; the model is not, so
    // the identity is published now and again when the cube answers.
    this.publishIdentity();
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
    await this.faceletsRequestPromise;
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
    await this.hardwareRequestPromise;
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
    await this.batteryRequestPromise;
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
    this.publishIdentity();
    this.onConnectionChange?.('disconnected');
    this.connectionStatusSubject.next('disconnected');
  }

  // ── Private: events subscription ────────────────────────────────────────────

  private setupEventsSubscription(): void {
    this.eventsSub?.unsubscribe();
    // Reset clock drift reconciler on (re)connect — cube clock may have reset
    this.clockReconciler = new ClockDriftReconciler();
    this.eventsSub = this.connection!.events$.subscribe((evt: GanCubeEvent) => {
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
          this.hardwareName = evt.hardwareName;
          this.model = evt.hardwareName;
        }
        if (evt.hardwareVersion) this.hardwareVersion = evt.hardwareVersion;
        if (evt.softwareVersion) this.softwareVersion = evt.softwareVersion;
        if (evt.productDate) this.productDate = evt.productDate;
        if (typeof evt.gyroSupported === 'boolean') {
          this.gyroSupported = evt.gyroSupported;
          this.gyroReported = true;
        }
        // Notify upstream consumers (e.g. orientation store) immediately
        // so the UI shows correct gyro status without needing the 3D panel.
        if (typeof evt.gyroSupported === 'boolean' || evt.hardwareName) {
          this.onHardwareInfo?.({
            model: this.model,
            gyroSupported: this.gyroSupported,
          });
        }
        this.publishIdentity();
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
    //
    // The GATT connection is dead either way, so it must not be kept around: it
    // used to stay set, which left `isConnected` true forever AND made
    // `attemptReconnect()` return on its own guard (`this.connection !== null`),
    // so an unexpected drop never reconnected at all — silently, and with the UI
    // still showing a connected cube. Clearing it is what makes the retry below
    // reachable.
    this.connection = null;
    this.publishIdentity();

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
        // Re-seed the serial tracker so moves aren't discarded after reconnect
        this.requestFacelets().catch(() => {});
        this.publishIdentity();
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
