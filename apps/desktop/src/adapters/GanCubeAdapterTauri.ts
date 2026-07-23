/**
 * GanCubeAdapter for Tauri Desktop.
 *
 * BRIDGE ARCHITECTURE:
 *   Rust (btleplug) ──ble:data──▶ TypeScript (decrypt + parse) ──▶ RxJS Subjects
 *   TypeScript ──invoke('send_cube_command')──▶ Rust ──GATT write──▶ Cube
 *
 * Reuses ALL existing protocol drivers, encrypters, and parsers from
 * @cubeforge/gan-protocol. The Rust backend handles ONLY BLE transport.
 */

import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';
import { SmartCubeAdapter } from '@cubeforge/hardware-hal';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Reuse the EXISTING GAN protocol stack — no duplication of crypto or parsing logic.
import type { GanCubeEvent, GanProtocolDriver } from '@cubeforge/gan-protocol';
import {
  GanGen2ProtocolDriver,
  GanGen3ProtocolDriver,
  GanGen4ProtocolDriver,
} from '@cubeforge/gan-protocol';
import {
  GanGen2CubeEncrypter,
  GanGen3CubeEncrypter,
  GanGen4CubeEncrypter,
} from '@cubeforge/gan-protocol';
import {
  GAN_GEN2_SERVICE,
  GAN_GEN3_SERVICE,
  GAN_GEN4_SERVICE,
  GAN_ENCRYPTION_KEYS,
} from '@cubeforge/gan-protocol';

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
// (Not exported from @cubeforge/gan-protocol — defined here to avoid touching packages/)
interface GanCubeRawConnection {
  sendCommandMessage(message: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}

// ── Tauri RawConnection adapter ─────────────────────────────────────────────

/**
 * Implements GanCubeRawConnection using Tauri invoke instead of Web Bluetooth.
 * This lets us reuse GanGen2ProtocolDriver (etc.) unchanged.
 */
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

  // Stable subjects — NEVER recreated across disconnect/reconnect cycles
  private movesSubject = new ReplaySubject<CubeMoveEvent>(1);
  private faceletsSubject = new ReplaySubject<string>(1);
  private batterySubject = new Subject<number>();
  private gyroSubject = new Subject<GyroEvent>();
  private connectionStatusSubject = new BehaviorSubject<
    'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  >('disconnected');

  public moves$ = this.movesSubject.asObservable();
  public facelets$ = this.faceletsSubject.asObservable();
  public battery$ = this.batterySubject.asObservable();
  public gyro$ = this.gyroSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // Protocol objects — created on connect, cleaned on disconnect
  private driver: GanProtocolDriver | null = null;
  private encrypter: GanGen2CubeEncrypter | null = null;
  private rawConn: TauriRawConnection | null = null;
  private macAddress: string = '';

  async connect(manualMac?: string): Promise<void> {
    this.connectionStatusSubject.next('connecting');
    this.onConnectionChange?.('connecting');

    try {
      const result = (await invoke('connect_gan_cube', {
        mac: manualMac ?? null,
      })) as { status: string; name: string; mac: string; generation: string };

      this._connected = true;
      this.model = result?.name ?? 'SmartCube';
      this.macAddress = result?.mac ?? '';

      // Determine cube generation from the service UUID returned by Rust
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

      // Listen for raw BLE data forwarded from Rust
      this.unlistenData = await listen<{ value: number[] }>('ble:data', (event) => {
        this.handleDataEvent(event.payload.value);
      });

      // Listen for disconnection events from Rust
      this.unlistenStatus = await listen<{ status: string; message?: string }>(
        'ble:status',
        (event) => {
          if (event.payload.status === 'disconnected') {
            this.handleDisconnect();
          }
        },
      );

      this.connectionStatusSubject.next('connected');
      this.onConnectionChange?.('connected');

      // Request initial state
      this.requestHardware().catch(() => {});
      this.requestBattery().catch(() => {});
    } catch (error) {
      this._connected = false;
      this.connectionStatusSubject.next('disconnected');
      this.onConnectionChange?.('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.unlistenData?.();
    this.unlistenData = null;
    this.unlistenStatus?.();
    this.unlistenStatus = null;

    try {
      await invoke('disconnect_gan_cube');
    } catch {
      // Already disconnected
    }

    this.cleanupProtocol();
  }

  private handleDisconnect(): void {
    this.unlistenData?.();
    this.unlistenData = null;
    this.cleanupProtocol();
    this._connected = false;
    this.connectionStatusSubject.next('disconnected');
    this.onConnectionChange?.('disconnected');
  }

  private cleanupProtocol(): void {
    this.driver = null;
    this.encrypter = null;
    this.rawConn = null;
    this._connected = false;
  }

  /**
   * Process raw BLE notification data from Rust:
   * decrypt → parse with protocol driver → emit to RxJS subjects.
   */
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
        const parsed = parseMoveNotation(evt.move);
        if (parsed) {
          this.movesSubject.next({
            face: parsed.face,
            direction: parsed.direction,
            cubeTimestamp: evt.cubeTimestamp ?? evt.timestamp,
            hostTimestamp: evt.localTimestamp ?? evt.timestamp,
          });
        }
        break;
      }
      case 'FACELETS':
        this.faceletsSubject.next(evt.facelets);
        this.onFacelets?.(evt.facelets);
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
        if (evt.hardwareName) this.model = evt.hardwareName;
        if (typeof evt.gyroSupported === 'boolean') this.gyroSupported = evt.gyroSupported;
        this.onHardwareInfo?.({
          model: this.model,
          gyroSupported: this.gyroSupported,
        });
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
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_FACELETS' });
    if (msg) await this.sendEncryptedCommand(msg);
  }

  async requestHardware(): Promise<void> {
    if (!this.driver) return;
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_HARDWARE' });
    if (msg) await this.sendEncryptedCommand(msg);
  }

  async requestBattery(): Promise<void> {
    if (!this.driver) return;
    const msg = this.driver.createCommandMessage({ type: 'REQUEST_BATTERY' });
    if (msg) await this.sendEncryptedCommand(msg);
  }
}
