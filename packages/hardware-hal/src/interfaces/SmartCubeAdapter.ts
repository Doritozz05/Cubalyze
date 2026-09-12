import { Observable } from 'rxjs';
import type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

export type { CubeMoveEvent, GyroEvent } from '@cubeforge/types';

/**
 * Everything a smart cube says about ITSELF, as it arrives.
 *
 * The fields are nullable on purpose, because the handshake is in two beats:
 * the connection succeeds first (which is when the address is known) and the
 * model, firmware and production date only arrive afterwards, when the cube
 * answers `REQUEST_HARDWARE`. A consumer that treats "no model yet" as "unknown
 * model" would label a GAN 14 as a placeholder, so the absence is explicit.
 */
export interface CubeIdentity {
  /** Manufacturer, as reported by the adapter ('GAN'). */
  vendor: string;
  /** Internal hardware name the cube reports, or null while it has not answered. */
  model: string | null;
  /**
   * Bluetooth address, exactly as read — which the GAN protocol walks
   * BACKWARDS, so it is not necessarily in the printed order. Comparison is
   * the caller's job (`normalizeSmartId` / `smartIdsMatch` in
   * `@cubeforge/database`); the adapter reports, it does not canonicalise.
   */
  mac: string | null;
  hardwareVersion: string | null;
  softwareVersion: string | null;
  /** Production date reported by the cube (format varies by generation). */
  productDate: string | null;
  /** True/false once the cube has answered, null while unknown. */
  gyroSupported: boolean | null;
}

export interface SmartCubeAdapter {
  readonly vendor: string;
  model: string;

  connect(manualMac?: string): Promise<void>;
  disconnect(): Promise<void>;

  moves$: Observable<CubeMoveEvent>;
  facelets$: Observable<string>;
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
  connectionStatus$?: Observable<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>;
  /**
   * Who the connected cube is, re-emitted as the handshake fills it in and
   * `null` on disconnect. Optional so an adapter that has not ported it yet
   * degrades to "no identity" instead of breaking the contract.
   */
  identity$?: Observable<CubeIdentity | null>;
}
