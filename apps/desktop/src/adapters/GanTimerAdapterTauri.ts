/**
 * GanTimerAdapter for Tauri Desktop.
 *
 * BRIDGE ARCHITECTURE:
 *   Rust (btleplug) ──ble:timer_event──▶ TypeScript (parse + emit)
 *   TypeScript ──invoke('connect_gan_timer')──▶ Rust ──GATT──▶ Timer
 *
 * Maps the GAN Timer protocol states to the HardwareTimerAdapter interface
 * (hardwareDown / hardwareUp / hardwareReset events) consumed by TimerEngine.
 *
 * Reuses the GanTimerState enum values from @cubeforge/gan-protocol.
 * Zero changes to packages/hardware-hal/.
 */

import { Subject } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { HardwareTimerAdapter, HardwareTimerEvent } from '@cubeforge/hardware-hal';

// ── Timer state constants (mirrors GanTimerState enum) ────────────────

const TIMER_STATE = {
  DISCONNECT: 0,
  GET_SET: 1,
  HANDS_OFF: 2,
  RUNNING: 3,
  STOPPED: 4,
  IDLE: 5,
  HANDS_ON: 6,
  FINISHED: 7,
} as const;

// ── Adapter ─────────────────────────────────────────────────────────────

export class GanTimerAdapterTauri implements HardwareTimerAdapter {
  public readonly name = 'GAN Smart Timer';

  private eventsSubject = new Subject<HardwareTimerEvent>();
  public events$ = this.eventsSubject.asObservable();

  private unlistenEvent: UnlistenFn | null = null;
  private unlistenStatus: UnlistenFn | null = null;
  private _connected = false;

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    // Tear down any previous listeners
    this.unlistenEvent?.();
    this.unlistenStatus?.();

    // Listen for timer events from Rust
    this.unlistenEvent = await listen<{
      state: number;
      stateName: string;
      recordedTime?: {
        minutes: number;
        seconds: number;
        milliseconds: number;
        asTimestamp: number;
      };
    }>('ble:timer_event', (event) => {
      this.handleTimerEvent(event.payload);
    });

    // Listen for status changes (connecting, connected, disconnected)
    this.unlistenStatus = await listen<{
      status: string;
      message?: string;
      name?: string;
      mac?: string;
    }>('ble:timer_status', (event) => {
      if (event.payload.status === 'disconnected') {
        this._connected = false;
      } else if (event.payload.status === 'connected') {
        this._connected = true;
      }
    });

    // Initiate the BLE connection via Rust
    await invoke('connect_gan_timer');
  }

  async disconnect(): Promise<void> {
    this.unlistenEvent?.();
    this.unlistenEvent = null;
    this.unlistenStatus?.();
    this.unlistenStatus = null;
    this._connected = false;

    try {
      await invoke('disconnect_gan_timer');
    } catch {
      // Ignore errors on disconnect — timer may already be gone
    }
  }

  /** Read recorded times from the timer (the last 4 times stored in memory). */
  async getRecordedTimes(): Promise<number[]> {
    try {
      const result = await invoke<{
        displayTime: { asTimestamp: number };
        previousTimes: [{ asTimestamp: number }, { asTimestamp: number }, { asTimestamp: number }];
      }>('get_timer_recorded_times');

      return [
        result.displayTime.asTimestamp,
        result.previousTimes[0].asTimestamp,
        result.previousTimes[1].asTimestamp,
        result.previousTimes[2].asTimestamp,
      ];
    } catch {
      return [];
    }
  }

  // ── Event Mapping ────────────────────────────────────────────────────
  //
  // Maps GAN Timer states to HardwareTimerAdapter events:
  //
  //   HANDS_ON  (6) → hardwareDown  (user touches timer)
  //   GET_SET   (1) → hardwareUp    (grace delay expired, ready to start)
  //   HANDS_OFF (2) → hardwareUp    (hands removed before grace delay)
  //   STOPPED   (4) → hardwareUp    (timer stopped, recorded time available)
  //   FINISHED  (7) → hardwareUp    (immediately after STOPPED)
  //   IDLE      (5) → hardwareReset (timer reset, idle)
  //   DISCONNECT(0) → disconnect cleanup

  private handleTimerEvent(payload: {
    state: number;
    stateName: string;
    recordedTime?: { asTimestamp: number };
  }): void {
    const now = performance.now();

    switch (payload.state) {
      case TIMER_STATE.HANDS_ON:
        this.eventsSubject.next({
          type: 'hardwareDown',
          leftHand: true,
          rightHand: false,
          timestamp: now,
        });
        break;

      case TIMER_STATE.GET_SET:
      case TIMER_STATE.HANDS_OFF:
      case TIMER_STATE.FINISHED:
        this.eventsSubject.next({
          type: 'hardwareUp',
          leftHand: false,
          rightHand: false,
          timestamp: now,
        });
        break;

      case TIMER_STATE.STOPPED:
        this.eventsSubject.next({
          type: 'hardwareUp',
          leftHand: false,
          rightHand: false,
          timestamp: now,
        });
        break;

      case TIMER_STATE.IDLE:
        this.eventsSubject.next({
          type: 'hardwareReset',
          leftHand: false,
          rightHand: false,
          timestamp: now,
        });
        break;

      case TIMER_STATE.DISCONNECT:
        this._connected = false;
        break;
    }
  }
}
