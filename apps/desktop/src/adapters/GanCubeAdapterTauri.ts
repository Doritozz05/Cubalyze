/**
 * GanCubeAdapter for Tauri Desktop.
 *
 * Uses Tauri commands (`invoke`) to communicate with the Rust backend via btleplug.
 * Implements the SAME `SmartCubeAdapter` interface as the web version.
 *
 * Lives in apps/desktop/ — NOT in hardware-hal. The web app never touches this file.
 */

import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';
import { SmartCubeAdapter } from '@cubeforge/hardware-hal';
import type { CubeMoveEvent, GyroEvent, CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

function parseMoveNotation(move: string): { face: CubeFace; direction: CubeMoveDirection } | null {
  const match = move.match(/^([UDRLBF])(2|'|2')?$/);
  if (!match) return null;
  const face = match[1] as CubeFace;
  let direction: CubeMoveDirection = 1;
  if (match[2] === "'" || match[2] === "2'") direction = -1;
  else if (match[2] === '2') direction = 2;
  return { face, direction };
}

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

  /**
   * Connect to a GAN cube via Tauri's native BLE backend.
   * NO browser popup — the Rust backend handles device discovery.
   */
  async connect(manualMac?: string): Promise<void> {
    this.connectionStatusSubject.next('connecting');
    this.onConnectionChange?.('connecting');

    try {
      const result = (await invoke('connect_gan_cube', {
        mac: manualMac ?? null,
      })) as { status: string; name: string; mac: string };

      this._connected = true;
      this.model = result?.name ?? 'SmartCube';

      // Listen for BLE status events emitted by the Rust backend
      this.unlistenStatus = await listen<{
        status: string;
        message?: string;
      }>('ble:status', (event) => {
        const { status } = event.payload;
        if (status === 'disconnected') {
          this._connected = false;
          this.connectionStatusSubject.next('disconnected');
          this.onConnectionChange?.('disconnected');
        } else if (status === 'connecting') {
          this.connectionStatusSubject.next('connecting');
          this.onConnectionChange?.('connecting');
        }
      });

      this.connectionStatusSubject.next('connected');
      this.onConnectionChange?.('connected');

      // Request initial state from the cube via GATT commands
      this.requestFacelets().catch(() => {});
      this.requestBattery().catch(() => {});
    } catch (error) {
      this._connected = false;
      this.connectionStatusSubject.next('disconnected');
      this.onConnectionChange?.('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.unlistenStatus?.();
    this.unlistenStatus = null;

    try {
      await invoke('disconnect_gan_cube');
    } catch {
      // Already disconnected or Rust backend not available
    }

    this._connected = false;
    this.connectionStatusSubject.next('disconnected');
    this.onConnectionChange?.('disconnected');
  }

  async requestFacelets(): Promise<void> {
    // TODO: Wire up GATT facelet requests through the Rust backend.
    // Currently, facelets are received via BLE notifications emitted by the Rust side.
    console.warn('[GanCubeAdapterTauri] requestFacelets not yet wired to Rust GATT backend');
  }

  async requestHardware(): Promise<void> {
    // Hardware info is requested during the Rust-side connect flow.
    // This stub exists to satisfy the SmartCubeAdapter interface.
  }

  async requestBattery(): Promise<void> {
    // TODO: Wire up GATT battery read through the Rust backend.
    console.warn('[GanCubeAdapterTauri] requestBattery not yet wired to Rust GATT backend');
  }
}
