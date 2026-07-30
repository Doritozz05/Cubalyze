import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GanCubeAdapter } from '../src/bluetooth/GanCubeAdapter';

// ────────────────────────────────────────────────────────────────────────
//  Helper: extract parseMoveNotation by calling handleMove through mock
// ────────────────────────────────────────────────────────────────────────
// Since parseMoveNotation is a module-level function (not exported),
// we test it indirectly through the moves$ observable and the public API.

describe('GanCubeAdapter — Nivel 2 Edge Cases', () => {
  let adapter: GanCubeAdapter;

  beforeEach(() => {
    adapter = new GanCubeAdapter();
  });

  // ────────────────────────────────────────────────────────────────────
  //  Connection state — pure logic, no BLE needed
  // ────────────────────────────────────────────────────────────────────

  describe('connection state', () => {
    it('isConnected returns false when not connected', () => {
      expect(adapter.isConnected).toBe(false);
    });

    it('vendor is GAN', () => {
      expect(adapter.vendor).toBe('GAN');
    });

    it('initial model is SmartCube', () => {
      expect(adapter.model).toBe('SmartCube');
    });

    it('gyroSupported defaults to false', () => {
      expect(adapter.gyroSupported).toBe(false);
    });

    it('moves$ observable exists and is subscribable', () => {
      expect(adapter.moves$).toBeDefined();
      const sub = adapter.moves$.subscribe(() => {});
      expect(sub).toBeDefined();
      sub.unsubscribe();
    });

    it('facelets$ observable exists', () => {
      expect(adapter.facelets$).toBeDefined();
      const sub = adapter.facelets$.subscribe(() => {});
      sub.unsubscribe();
    });

    it('battery$ observable exists', () => {
      expect(adapter.battery$).toBeDefined();
    });

    it('gyro$ observable exists', () => {
      expect(adapter.gyro$).toBeDefined();
      const sub = adapter.gyro$.subscribe(() => {});
      sub.unsubscribe();
    });

    it('connectionStatus$ observable exists', () => {
      expect(adapter.connectionStatus$).toBeDefined();
    });

    it('invalidMoves$ observable exists', () => {
      expect(adapter.invalidMoves$).toBeDefined();
    });

    it('onConnectionChange is initially null', () => {
      expect(adapter.onConnectionChange).toBeNull();
    });

    it('onHardwareInfo is initially null', () => {
      expect(adapter.onHardwareInfo).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  requestFacelets / requestBattery / requestHardware: null connection
  // ────────────────────────────────────────────────────────────────────

  describe('request* methods — no connection', () => {
    it('requestFacelets returns immediately when not connected', async () => {
      // Should not throw
      await expect(adapter.requestFacelets()).resolves.toBeUndefined();
    });

    it('requestBattery returns immediately when not connected', async () => {
      await expect(adapter.requestBattery()).resolves.toBeUndefined();
    });

    it('requestHardware returns immediately when not connected', async () => {
      await expect(adapter.requestHardware()).resolves.toBeUndefined();
    });

    it('disconnect returns immediately when not connected', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  onFacelets callback
  // ────────────────────────────────────────────────────────────────────

  describe('onFacelets callback', () => {
    it('can be set and is null by default', () => {
      expect(adapter.onFacelets).toBeNull();
    });

    it('can be assigned a callback', () => {
      const cb = vi.fn();
      adapter.onFacelets = cb;
      expect(adapter.onFacelets).toBe(cb);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Observable stability across reconnect (subjects survive disconnect)
  // ────────────────────────────────────────────────────────────────────

  describe('RxJS subject stability', () => {
    it('moves$ subject survives multiple subscribe/unsubscribe cycles', () => {
      const sub1 = adapter.moves$.subscribe(() => {});
      sub1.unsubscribe();
      const sub2 = adapter.moves$.subscribe(() => {});
      sub2.unsubscribe();
      // No error = pass
    });

    it('connectionStatus$ starts as disconnected', () => {
      const statuses: string[] = [];
      const sub = adapter.connectionStatus$.subscribe(s => statuses.push(s));
      expect(statuses).toEqual(['disconnected']);
      sub.unsubscribe();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
//  GanTimerAdapter edge cases
// ────────────────────────────────────────────────────────────────────────

import { GanTimerAdapter } from '../src/bluetooth/GanTimerAdapter';

describe('GanTimerAdapter — Nivel 2 Edge Cases', () => {
  let adapter: GanTimerAdapter;

  beforeEach(() => {
    adapter = new GanTimerAdapter();
  });

  describe('basic properties', () => {
    it('name is GAN Smart Timer', () => {
      expect(adapter.name).toBe('GAN Smart Timer');
    });

    it('events$ observable exists', () => {
      expect(adapter.events$).toBeDefined();
    });

    it('getRecordedTimes returns empty array when not connected', async () => {
      const times = await adapter.getRecordedTimes();
      expect(times).toEqual([]);
    });

    it('disconnect returns immediately when not connected', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });
});
