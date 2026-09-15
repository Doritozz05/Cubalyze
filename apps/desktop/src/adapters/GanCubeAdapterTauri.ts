/**
 * GanCubeAdapter for Tauri Desktop.
 *
 * BRIDGE ARCHITECTURE:
 *   Rust (btleplug) ──ble:data──▶ TypeScript (decrypt + parse) ──▶ RxJS Subjects
 *   TypeScript ──invoke('send_cube_command')──▶ Rust ──GATT write──▶ Cube
 *
 * Reuses ALL existing protocol drivers, encrypters, and parsers from
 * @cubalyze/gan-protocol. The Rust backend handles ONLY BLE transport.
 *
 * FUNCTIONAL PARITY with web GanCubeAdapter:
 *   - ClockDriftReconciler for accurate move timestamps
 *   - invalidMoves$ subject for unrecognized move tracking
 *   - FACELETS validation (54-character standard 3x3 cube)
 *   - Same reconnection parameters (3 attempts, 1000ms base)
 */

import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';
import { SmartCubeAdapter, ClockDriftReconciler, type CubeIdentity } from '@cubalyze/hardware-hal';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubalyze/types';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Reuse the EXISTING GAN protocol stack — no duplication of crypto or parsing logic.
import type { GanCubeEvent, GanProtocolDriver } from '@cubalyze/gan-protocol';
import {
  GanGen2ProtocolDriver,
  GanGen3ProtocolDriver,
  GanGen4ProtocolDriver,
} from '@cubalyze/gan-protocol';
import {
  GanGen2CubeEncrypter,
  GanGen3CubeEncrypter,
  GanGen4CubeEncrypter,
} from '@cubalyze/gan-protocol';
import {
  GAN_GEN2_SERVICE,
  GAN_GEN3_SERVICE,
  GAN_GEN4_SERVICE,
  GAN_ENCRYPTION_KEYS,
} from '@cubalyze/gan-protocol';

// ── Reconnection Constants (matched to web adapter) ───────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

// ── Helpers ────────────────────────────────────────────────────────────────

function parseMoveNotation(move: string): { face: CubeFace; direction: CubeMoveDirection } | null {
  const match = move.match(/^([UDRLBF])(2|'|2')?$/);
  if (!match) return null;
  const face = match[1] as CubeFace;
  let direction: CubeMoveDirection = 1;
  if (match[2] === "'" || match[2] === "2'") direction = -1;
  else if (match[2] === '2') direction = 2;
  return { face, direction };
}

/** Convert MAC address string like "AA:BB:CC:DD:EE:FF" to a 6-byte Uint8Array salt (reversed). */
function macToSalt(mac: string): Uint8Array {
  return new Uint8Array(
    mac
      .split(/[:\\-\\s]+/)
      .map((c) => parseInt(c, 16))
      .reverse(),
  );
}

// ── Local GanCubeRawConnection interface ──────────────────────────────────

interface GanCubeRawConnection {
  sendCommandMessage(message: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}

// ── Tauri RawConnection adapter ─────────────────────────────────────────────

class TauriRawConnection implements GanCubeRawConnection {
  async sendCommandMessage(message: Uint8Array): Promise<void> {
    await invoke('send_cube_command', { data: Array.from(message) });
  }
  async disconnect(): Promise<void> {
    await invoke('disconnect_gan_cube');
  }
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export class GanCubeAdapterTauri implements SmartCubeAdapter {
  public readonly vendor = 'GAN';
  public model = 'SmartCube';
  public gyroSupported = false;

  // ── Hardware identity (parity with the web adapter) ─────────────────────
  //
  // The Rust side already knows the address when the connection comes up, and
  // the HARDWARE answer carries the internal model name, the firmware and the
  // production date. Published as one stream so the Locker can resolve which
  // item this cube is, exactly as on the web.
  private hardwareName: string | null = null;
  private hardwareVersion: string | null = null;
  private softwareVersion: string | null = null;
  private productDate: string | null = null;
  private gyroReported = false;
  private currentIdentity: CubeIdentity | null = null;
  private identitySubject = new ReplaySubject<CubeIdentity | null>(1);

  public identity$ = this.identitySubject.asObservable();

  constructor() {
    this.identitySubject.next(null);
  }

  public get identity(): CubeIdentity | null {
    return this.currentIdentity;
  }

  public onConnectionChange:
    | ((status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void)
    | null = null;

  public onHardwareInfo: ((info: { model: string; gyroSupported: boolean }) => void) | null = null;
  public onFacelets: ((facelets: string) => void) | null = null;

  public get isConnected(): boolean {
    return this._connected;
  }

  private _connected = false;
  private unlistenData: UnlistenFn | null = null;
  private unlistenStatus: UnlistenFn | null = null;

  // ── RxJS Subjects (stable, never recreated — matches web adapter) ────
  private movesSubject = new ReplaySubject<CubeMoveEvent>(1);
  private faceletsSubject = new ReplaySubject<string>(1);
  private batterySubject = new Subject<number>();
  private gyroSubject = new Subject<GyroEvent>();
  private invalidMovesSubject = new Subject<string>();
  private connectionStatusSubject = new BehaviorSubject<
    'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  >('disconnected');

  public moves$ = this.movesSubject.asObservable();
  public facelets$ = this.faceletsSubject.asObservable();
  public battery$ = this.batterySubject.asObservable();
  public gyro$ = this.gyroSubject.asObservable();
  public invalidMoves$ = this.invalidMovesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  private publishIdentity(): void {
    if (!this.driver) {
      this.currentIdentity = null;
      this.identitySubject.next(null);
      return;
    }
    this.currentIdentity = {
      vendor: this.vendor,
      model: this.hardwareName,
      mac: this.macAddress || null,
      hardwareVersion: this.hardwareVersion,
      softwareVersion: this.softwareVersion,
      productDate: this.productDate,
      gyroSupported: this.gyroReported ? this.gyroSupported : null,
    };
    this.identitySubject.next(this.currentIdentity);
  }

  // ── Protocol objects ───────────────────────────────────────────────────
  private driver: GanProtocolDriver | null = null;
  private encrypter: GanGen2CubeEncrypter | null = null;
  private rawConn: TauriRawConnection | null = null;
  private macAddress: string = '';

  // ── Clock drift correction (matches web adapter) ───────────────────────
  private clockReconciler = new ClockDriftReconciler();

  // ── Reconnection state ──────────────────────────────────────────────────
  private isUserDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Deduplication promises (same pattern as web adapter) ────────────────
  private faceletsRequestPromise: Promise<void> | null = null;
  private hardwareRequestPromise: Promise<void> | null = null;
  private batteryRequestPromise: Promise<void> | null = null;

  async connect(manualMac?: string): Promise<void> {
    this.isUserDisconnect = false;
    this.reconnectAttempts = 0;
    this.cancelReconnect();

    this.connectionStatusSubject.next('connecting');
    this.onConnectionChange?.('connecting');

    try {
      const result = (await invoke('connect_gan_cube', {
        mac: manualMac ?? null,
      })) as { status: string; name: string; mac: string; generation: string };

      await this.setupProtocol(result);
    } catch (error) {
      this._connected = false;
      this.connectionStatusSubject.next('disconnected');
      this.onConnectionChange?.('disconnected');
      throw error;
    }
  }

  /** Setup protocol stack after a successful GATT connection (shared by connect + reconnect). */
  private async setupProtocol(result: {
    status: string;
    name: string;
    mac: string;
    generation: string;
  }): Promise<void> {
    this._connected = true;
    this.model = result?.name ?? 'SmartCube';
    this.macAddress = result?.mac ?? '';

    // A new connection may be a different cube: nothing learned from the
    // previous one survives (the HARDWARE request below repopulates it).
    this.hardwareName = null;
    this.hardwareVersion = null;
    this.softwareVersion = null;
    this.productDate = null;
    this.gyroReported = false;
    this.gyroSupported = false;

    const genService = result.generation.toLowerCase();
    const salt = macToSalt(this.macAddress);

    let key: { key: number[]; iv: number[] };

    if (genService === GAN_GEN2_SERVICE) {
      key = result.name?.startsWith('AiCube') ? GAN_ENCRYPTION_KEYS[1] : GAN_ENCRYPTION_KEYS[0];
      this.encrypter = new GanGen2CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      this.driver = new GanGen2ProtocolDriver();
    } else if (genService === GAN_GEN3_SERVICE) {
      key = GAN_ENCRYPTION_KEYS[0];
      this.encrypter = new GanGen3CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      this.driver = new GanGen3ProtocolDriver();
    } else if (genService === GAN_GEN4_SERVICE) {
      key = GAN_ENCRYPTION_KEYS[0];
      this.encrypter = new GanGen4CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      this.driver = new GanGen4ProtocolDriver();
    } else {
      throw new Error(`Unsupported cube generation: ${genService}`);
    }

    this.rawConn = new TauriRawConnection();

    // Reset clock drift reconciler on (re)connect — cube clock may have reset
    this.clockReconciler = new ClockDriftReconciler();

    // Tear down any previous listeners before setting up new ones
    this.unlistenData?.();
    this.unlistenStatus?.();

    this.unlistenData = await listen<{ value: number[] }>('ble:data', (event) => {
      this.handleDataEvent(event.payload.value);
    });

    this.unlistenStatus = await listen<{ status: string; message?: string }>(
      'ble:status',
      (event) => {
        if (event.payload.status === 'disconnected') {
          this.handleDisconnect();
        }
      },
    );

    this.reconnectAttempts = 0;

    // The address is known now; the model is not, so the identity is published
    // here and again when the cube answers the hardware request.
    this.publishIdentity();
    this.connectionStatusSubject.next('connected');
    this.onConnectionChange?.('connected');

    // Request initial state — errors are non-fatal (cube may not support all commands)
    this.requestHardware().catch(() => {});
    this.requestBattery().catch(() => {});
    // Seed the protocol driver's serial tracker: the GAN driver DISCARDS
    // every MOVE until the first FACELETS event arrives (its lastSerial
    // starts at -1). Requesting facelets right after connect closes that
    // window, so the first moves after auto-connect are never dropped.
    this.requestFacelets().catch(() => {});
  }

  async disconnect(): Promise<void> {
    this.isUserDisconnect = true;
    this.cancelReconnect();
    this.cleanupProtocol();

    // Emit disconnected state — cleanupProtocol tears down the
    // listeners that would normally catch the Rust disconnect event,
    // so we must set the status explicitly here.
    this.connectionStatusSubject.next('disconnected');
    this.onConnectionChange?.('disconnected');
  }

  // ── Reconnection Logic ────────────────────────────────────────────────────

  private handleDisconnect(): void {
    this.unlistenData?.();
    this.unlistenData = null;
    this.unlistenStatus?.();
    this.unlistenStatus = null;

    this.driver = null;
    this.encrypter = null;
    this.rawConn = null;
    this._connected = false;
    this.publishIdentity();

    if (!this.isUserDisconnect && this.macAddress) {
      this.attemptReconnect();
    } else {
      this.connectionStatusSubject.next('disconnected');
      this.onConnectionChange?.('disconnected');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer !== null) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts = 0;
      this.macAddress = '';
      this.connectionStatusSubject.next('disconnected');
      this.onConnectionChange?.('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.connectionStatusSubject.next('reconnecting');
    this.onConnectionChange?.('reconnecting');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        const result = (await invoke('reconnect_gan_cube')) as {
          status: string;
          name: string;
          mac: string;
          generation: string;
        };
        await this.setupProtocol(result);
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

  private cleanupProtocol(): void {
    this.unlistenData?.();
    this.unlistenData = null;
    this.unlistenStatus?.();
    this.unlistenStatus = null;

    this.driver = null;
    this.encrypter = null;
    this.rawConn = null;
    this._connected = false;
    this.macAddress = '';
    this.publishIdentity();

    invoke('disconnect_gan_cube').catch(() => {});
  }

  // ── Data Processing ─────────────────────────────────────────────────────

  private async handleDataEvent(rawBytes: number[]): Promise<void> {
    if (!this.encrypter || !this.driver || !this.rawConn) return;

    try {
      const encrypted = new Uint8Array(rawBytes);
      const decrypted = this.encrypter.decrypt(encrypted);
      const events: GanCubeEvent[] = await this.driver.handleStateEvent(this.rawConn, decrypted);

      for (const evt of events) {
        this.emitEvent(evt);
      }
    } catch (err) {
      console.warn('[GanCubeAdapterTauri] Failed to process BLE data:', err);
    }
  }

  private emitEvent(evt: GanCubeEvent): void {
    switch (evt.type) {
      case 'MOVE': {
        const hostNow = performance.now();
        const cubeTs = evt.cubeTimestamp ?? hostNow;

        if (evt.cubeTimestamp != null) {
          this.clockReconciler.addDataPoint(evt.cubeTimestamp, hostNow);
        }
        const correctedHostTs = evt.cubeTimestamp != null
          ? this.clockReconciler.reconcile(evt.cubeTimestamp)
          : hostNow;

        const parsed = parseMoveNotation(evt.move);
        if (!parsed) {
          console.warn('[GanCubeAdapterTauri] Unrecognized move:', evt.move);
          this.invalidMovesSubject.next(evt.move);
          return;
        }

        this.movesSubject.next({
          face: parsed.face,
          direction: parsed.direction,
          cubeTimestamp: cubeTs,
          hostTimestamp: correctedHostTs,
        });
        break;
      }
      case 'FACELETS':
        // Validate: standard 3x3 cube facelets are exactly 54 characters
        if (typeof evt.facelets === 'string' && evt.facelets.length === 54) {
          this.faceletsSubject.next(evt.facelets);
          this.onFacelets?.(evt.facelets);
        } else {
          console.warn('[GanCubeAdapterTauri] Invalid FACELETS state received:', evt.facelets);
        }
        break;
      case 'BATTERY':
        this.batterySubject.next(evt.batteryLevel);
        break;
      case 'GYRO':
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
        break;
      case 'HARDWARE':
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
        // Only notify if something actually changed (matches web adapter guard)
        if (typeof evt.gyroSupported === 'boolean' || evt.hardwareName) {
          this.onHardwareInfo?.({
            model: this.model,
            gyroSupported: this.gyroSupported,
          });
        }
        this.publishIdentity();
        break;
    }
  }

  // ── Commands (encrypt + send via Rust) ──────────────────────────────────

  private async sendEncryptedCommand(buffer: Uint8Array): Promise<void> {
    if (!this.encrypter || !this.rawConn) return;
    const encrypted = this.encrypter.encrypt(buffer);
    await this.rawConn.sendCommandMessage(encrypted);
  }

  async requestFacelets(): Promise<void> {
    if (!this.driver) return;
    if (this.faceletsRequestPromise) return this.faceletsRequestPromise;
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_FACELETS' });
    if (!msg) return;
    this.faceletsRequestPromise = this.sendEncryptedCommand(msg).finally(() => {
      this.faceletsRequestPromise = null;
    });
    return this.faceletsRequestPromise;
  }

  async requestHardware(): Promise<void> {
    if (!this.driver) return;
    if (this.hardwareRequestPromise) return this.hardwareRequestPromise;
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_HARDWARE' });
    if (!msg) return;
    this.hardwareRequestPromise = this.sendEncryptedCommand(msg).finally(() => {
      this.hardwareRequestPromise = null;
    });
    return this.hardwareRequestPromise;
  }

  async requestBattery(): Promise<void> {
    if (!this.driver) return;
    if (this.batteryRequestPromise) return this.batteryRequestPromise;
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_BATTERY' });
    if (!msg) return;
    this.batteryRequestPromise = this.sendEncryptedCommand(msg).finally(() => {
      this.batteryRequestPromise = null;
    });
    return this.batteryRequestPromise;
  }
}
