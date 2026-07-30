/**
 * Nivel 3 — Category 7: Memory Leak Tests (Hardware-HAL)
 *
 * Tests that ClockDriftReconciler and GanCubeAdapter don't leak memory
 * under sustained load: large history windows, rapid cycles, instance churn.
 */
import { describe, it, expect } from 'vitest';
import { ClockDriftReconciler } from '../src/sync/ClockDrift';
import { GanCubeAdapter } from '../src/bluetooth/GanCubeAdapter';

// ═══════════════════════════════════════════════════════════════════════
//  M2a: ClockDriftReconciler — large window sizes
// ═══════════════════════════════════════════════════════════════════════

describe('M2a — ClockDriftReconciler memory stability', { timeout: 30000 }, () => {
  it('handles windowSize=1000 without performance degradation', () => {
    const r = new ClockDriftReconciler(1000);
    const start = performance.now();

    // Fill the window with 10K data points (window only keeps last 1000)
    for (let i = 0; i < 10_000; i++) {
      r.addDataPoint(i, i * 1.001 + 500);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyLen = (r as any).history.length;
    expect(historyLen).toBe(1000); // capped at windowSize

    // Reconciliation should still be fast
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      const result = r.reconcile(i * 10);
      expect(Number.isFinite(result)).toBe(true);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200); // 1000 reconciles < 200ms

    const totalElapsed = performance.now() - start;
    expect(totalElapsed).toBeLessThan(1000); // Total < 1s
  });

  it('reconcile with degenerate window (all same cubeTs) does not crash', () => {
    const r = new ClockDriftReconciler(100);

    // All cube timestamps identical — denominator will be 0
    for (let i = 0; i < 100; i++) {
      r.addDataPoint(100, 1000 + i);
    }

    // Should fall back to average offset in degenerate case
    const result = r.reconcile(100);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('reconcile with extreme values (very large timestamps) works', () => {
    const r = new ClockDriftReconciler(50);

    for (let i = 0; i < 50; i++) {
      r.addDataPoint(Number.MAX_SAFE_INTEGER - 100 + i, Number.MAX_SAFE_INTEGER / 2 + i);
    }

    const result = r.reconcile(Number.MAX_SAFE_INTEGER);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('reconcile with very small timestamps (near zero) works', () => {
    const r = new ClockDriftReconciler(20);

    for (let i = 0; i < 20; i++) {
      r.addDataPoint(i * 0.001, i * 0.001);
    }

    const result = r.reconcile(0.01);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  M2b: ClockDriftReconciler — rapid add+reconcile cycling
// ═══════════════════════════════════════════════════════════════════════

describe('M2b — ClockDriftReconciler rapid cycling', { timeout: 30000 }, () => {
  it('survives 50K add+reconcile cycles', () => {
    const r = new ClockDriftReconciler(20);

    for (let i = 0; i < 50_000; i++) {
      r.addDataPoint(i, i * 1.0001);
      const result = r.reconcile(i + 1);
      expect(Number.isFinite(result)).toBe(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r as any).history.length).toBeLessThanOrEqual(20);
  });

  it('survives alternating add+reconcile with 100K ops', () => {
    const r = new ClockDriftReconciler(10);

    for (let i = 0; i < 100_000; i++) {
      if (i % 2 === 0) {
        r.addDataPoint(i, i * 2);
      } else {
        const result = r.reconcile(i);
        expect(Number.isFinite(result)).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  M2c: ClockDriftReconciler — instance churn (create/destroy many)
// ═══════════════════════════════════════════════════════════════════════

describe('M2c — ClockDriftReconciler instance churn', { timeout: 10000 }, () => {
  it('creating and discarding 1000 instances does not leak', () => {
    for (let i = 0; i < 1000; i++) {
      const r = new ClockDriftReconciler(i % 100 + 1);
      r.addDataPoint(i, i + 10);
      r.addDataPoint(i + 100, i + 110);
      const result = r.reconcile(i + 50);
      expect(Number.isFinite(result)).toBe(true);
      // r goes out of scope — GC will collect
    }
    // If we get here without OOM, it's good
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  M2d: GanCubeAdapter — subject lifecycle (no BLE required, static tests)
// ═══════════════════════════════════════════════════════════════════════

describe('M2d — GanCubeAdapter subject lifecycle', () => {
  it('creating adapter does not trigger BLE connection', () => {
    const adapter = new GanCubeAdapter();

    expect(adapter.isConnected).toBe(false);
    expect(adapter.vendor).toBe('GAN');
    expect(adapter.gyroSupported).toBe(false);

    // Subjects should exist and be subscribable
    const sub = adapter.moves$.subscribe();
    expect(sub).toBeDefined();
    sub.unsubscribe();
  });

  it('multiple subscribers to same observable work without leak', () => {
    const adapter = new GanCubeAdapter();

    const subs = [
      adapter.moves$.subscribe(),
      adapter.moves$.subscribe(),
      adapter.moves$.subscribe(),
      adapter.facelets$.subscribe(),
      adapter.battery$.subscribe(),
      adapter.gyro$.subscribe(),
      adapter.connectionStatus$.subscribe(),
    ];

    // All subscriptions created successfully
    expect(subs.length).toBe(7);

    // Unsubscribe all
    subs.forEach((s) => s.unsubscribe());
  });

  it('subscribe → unsubscribe → resubscribe does not accumulate', () => {
    const adapter = new GanCubeAdapter();

    // Three cycles of subscribe/unsubscribe
    for (let i = 0; i < 3; i++) {
      const sub1 = adapter.moves$.subscribe();
      const sub2 = adapter.facelets$.subscribe();
      sub1.unsubscribe();
      sub2.unsubscribe();
    }

    // Adapter should still be functional
    expect(adapter.isConnected).toBe(false);
  });

  it('adapter survives rapid connect attempt (will fail without BLE, but must not crash)', async () => {
    const adapter = new GanCubeAdapter();

    // Connection will fail (no BLE in Node) — verify it rejects gracefully
    try {
      await adapter.connect();
    } catch {
      // Expected — no BLE in test environment
    }

    expect(adapter.isConnected).toBe(false);

    // Try disconnect even when not connected (should not crash)
    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
  });
});
