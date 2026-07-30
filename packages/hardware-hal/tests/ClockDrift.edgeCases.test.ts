/**
 * Nivel 2 — Edge cases para ClockDriftReconciler
 *
 * Casos frontera para la reconciliación de reloj entre el hardware
 * del cubo (crystal interno) y el host (performance.now):
 *
 * • Sin data points, 1 data point (fallback a offset simple)
 * • Drift negativo (reloj del cubo más rápido que el host)
 * • Denominador cero (todos los cubeTs iguales)
 * • NaN, Infinity, números negativos
 * • Overflow de timestamp, valores muy grandes
 * • Data points no monotónicos
 * • Ventana llena + nuevos puntos (shift)
 */
import { describe, it, expect } from 'vitest';
import { ClockDriftReconciler } from '../src/sync/ClockDrift';

describe('ClockDriftReconciler — Nivel 2 Edge Cases', () => {
  // ── Sin datos ──────────────────────────────────────────────────────

  it('reconcile sin data points devuelve cubeTs intacto', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(1000)).toBe(1000);
  });

  it('reconcile sin data points devuelve 0 si cubeTs=0', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(0)).toBe(0);
  });

  it('reconcile sin data points devuelve NaN si cubeTs=NaN', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(NaN)).toBeNaN();
  });

  // ── 1 data point (fallback a offset simple) ────────────────────────

  it('1 data point: reconcile usa offset directo', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050); // offset = 50
    expect(r.reconcile(2000)).toBe(2050); // 2000 + 50
  });

  it('1 data point con offset negativo', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(2000, 1900); // offset = -100
    expect(r.reconcile(3000)).toBe(2900); // 3000 - 100
  });

  it('1 data point: reconcile del mismo cubeTs', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    expect(r.reconcile(1000)).toBe(1050);
  });

  // ── 2+ data points con drift lineal ────────────────────────────────

  it('drift lineal perfecto: host = cube + 50', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    r.addDataPoint(3000, 3050);
    expect(r.reconcile(4000)).toBe(4050);
  });

  it('drift con pendiente: cubo más rápido que host', () => {
    // Cube avanza 1000, host solo 900 (cubo más rápido)
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 900);
    r.addDataPoint(2000, 1800);
    // Pendiente = 0.9, intercept = 0
    // reconcile(3000) = 0.9 * 3000 + 0 = 2700
    expect(r.reconcile(3000)).toBe(2700);
  });

  it('drift con pendiente: cubo más lento que host (drift negativo)', () => {
    // Cube avanza 1000, host avanza 1100 (cubo más lento)
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1100);
    r.addDataPoint(2000, 2200);
    // Pendiente = 1.1, intercept = 0 → reconcile(3000) ≈ 3300
    expect(r.reconcile(3000)).toBeCloseTo(3300, 10);
  });

  // ── Denominador cero (todos los cubeTs iguales) ────────────────────

  it('todos los cubeTs iguales → fallback a average offset', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(1000, 1060);
    r.addDataPoint(1000, 1040);
    // Todos x=1000, average offset = (1050+1060+1040)/3 - 1000 = 50
    expect(r.reconcile(2000)).toBe(2050); // 2000 + 50
  });

  it('2 data points con mismo cubeTs pero distinto hostTs', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(500, 550);
    r.addDataPoint(500, 560);
    // denominator = 0 → fallback average offset = (550+560)/2 - 500 = 55
    expect(r.reconcile(1000)).toBe(1055);
  });

  // ── NaN e Infinity en data points ─────────────────────────────────

  it('addDataPoint con cubeTs NaN se incluye (se propaga a la regresión)', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(NaN, 1000);
    r.addDataPoint(1000, 2000);
    // NaN contamina sumX, pero la función no filtra
    const result = r.reconcile(2000);
    expect(isNaN(result)).toBe(true);
  });

  it('addDataPoint con hostTs Infinity', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, Infinity);
    const result = r.reconcile(2000);
    expect(isFinite(result)).toBe(false);
  });

  // ── Valores extremos ──────────────────────────────────────────────

  it('timestamps muy grandes (cercanos a Number.MAX_SAFE_INTEGER)', () => {
    const r = new ClockDriftReconciler(20);
    const big = Number.MAX_SAFE_INTEGER / 2;
    r.addDataPoint(big, big + 100);
    r.addDataPoint(big + 1000, big + 1100);
    const result = r.reconcile(big + 2000);
    expect(result).toBe(big + 2100); // big + 2000 + 100 offset
  });

  it('timestamps negativos (no debería pasar, pero no debe crashear)', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(-1000, -900);
    r.addDataPoint(-500, -400);
    const result = r.reconcile(0);
    expect(isFinite(result)).toBe(true);
  });

  it('timestamps cero', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 50);
    r.addDataPoint(1000, 1050);
    expect(r.reconcile(500)).toBe(550);
  });

  // ── Datos no monotónicos ───────────────────────────────────────────

  it('data points desordenados (no monotónicos) no crashean', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(3000, 3050);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    // El orden no importa para la regresión lineal
    const result = r.reconcile(4000);
    expect(isFinite(result)).toBe(true);
  });

  // ── Ventana llena + rotación ───────────────────────────────────────

  it('ventana de tamaño 2: solo los 2 últimos cuentan', () => {
    const r = new ClockDriftReconciler(2);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1000);
    r.addDataPoint(2000, 1900); // Empuja (0,0) fuera
    // Ventana tiene: (1000,1000) y (2000,1900)
    // Pendiente = (2*1900000 - 3000*2900) / (2*5000000 - 3000^2)
    // = (3800000 - 8700000) / (10000000 - 9000000) = -4900000/1000000 = -4.9? 
    // No, espera: 
    // sumX = 3000, sumY = 2900, sumXY = 1000*1000 + 2000*1900 = 4800000
    // sumXX = 1000^2 + 2000^2 = 5000000, n=2
    // denominator = 2*5000000 - 3000^2 = 10000000 - 9000000 = 1000000
    // m = (2*4800000 - 3000*2900) / 1000000 = (9600000 - 8700000) / 1000000 = 0.9
    // b = (2900 - 0.9*3000) / 2 = (2900-2700)/2 = 100
    // reconcile(3000) = 0.9*3000 + 100 = 2800
    expect(r.reconcile(3000)).toBe(2800);
  });

  it('addDataPoint mantiene máximo windowSize elementos', () => {
    const r = new ClockDriftReconciler(3);
    r.addDataPoint(0, 0);
    r.addDataPoint(100, 100);
    r.addDataPoint(200, 200);
    expect(r['history'].length).toBe(3);
    r.addDataPoint(300, 300); // Empuja (0,0) fuera
    expect(r['history'].length).toBe(3);
    expect(r['history'][0].cubeTs).toBe(100);
  });

  // ── Drift sin offset (relojes sincronizados) ───────────────────────

  it('relojes perfectamente sincronizados: reconcile(x) ≈ x', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1000);
    r.addDataPoint(2000, 2000);
    expect(r.reconcile(3000)).toBe(3000);
  });

  // ── Un solo data point después de muchos ───────────────────────────

  it('después de la regresión lineal, 1 data point + reconcile funciona', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    // 2 data points → regresión lineal
    expect(r.reconcile(3000)).toBe(3050);
  });

  // ── Reconcile con valores extremos después de data points ──────────

  it('reconcile con cubeTs = 0 después de data points positivos', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    const result = r.reconcile(0);
    // Extrapolación lineal hacia atrás
    expect(isFinite(result)).toBe(true);
  });

  // ── Resistencia a NaN en reconcile ─────────────────────────────────

  it('reconcile(NaN) después de data points válidos devuelve NaN', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    expect(r.reconcile(NaN)).toBeNaN();
  });
});
