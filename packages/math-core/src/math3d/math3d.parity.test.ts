// PERMANENT parity guard — compares math3d implementations against three.js.
//
// WHY: math-core dropped the three.js dependency in favour of the dependency-
// free math3d module (FaceletParser / OrientationTable). These tests prove the
// replacements are numerically identical to three.js (including antiparallel
// edge cases), and lock in the Quaternion interop contract used by
// cube-3d-engine (three's copy() reads public x/y/z/w, slerp() reads _x).
import { describe, it, expect } from 'vitest';
import { Vector3 as M3, Quaternion as MQ } from './index';
import { Vector3 as T3, Quaternion as TQ } from 'three';

// Deterministic LCG
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomUnitVector(rng: () => number): T3 {
  const v = new T3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
  if (v.length() < 1e-9) return new T3(1, 0, 0);
  return v.normalize();
}

function randomUnitQuat(rng: () => number): TQ {
  return new TQ().setFromAxisAngle(randomUnitVector(rng), rng() * Math.PI * 2);
}

function close(a: number, b: number, eps: number) {
  return Math.abs(a - b) <= eps;
}

describe('math3d ↔ three.js parity', () => {
  it('Quaternion.setFromAxisAngle matches three.js', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 200; i++) {
      const axis = randomUnitVector(rng);
      const angle = rng() * Math.PI * 2 - Math.PI;
      const mt = new MQ().setFromAxisAngle(new M3(axis.x, axis.y, axis.z), angle);
      const th = new TQ().setFromAxisAngle(axis, angle);
      expect(Math.abs(mt.x - th.x)).toBeLessThan(1e-12);
      expect(Math.abs(mt.y - th.y)).toBeLessThan(1e-12);
      expect(Math.abs(mt.z - th.z)).toBeLessThan(1e-12);
      expect(Math.abs(mt.w - th.w)).toBeLessThan(1e-12);
    }
  });

  it('Quaternion.setFromUnitVectors matches three.js (incl. antiparallel)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      let from = randomUnitVector(rng);
      let to = randomUnitVector(rng);
      if (i % 5 === 0) to = from.clone().negate(); // antiparallel
      if (i % 7 === 0) to = from.clone(); // parallel
      const mt = new MQ().setFromUnitVectors(new M3(from.x, from.y, from.z), new M3(to.x, to.y, to.z));
      const th = new TQ().setFromUnitVectors(from, to);
      expect(Math.abs(mt.x - th.x)).toBeLessThan(1e-9);
      expect(Math.abs(mt.y - th.y)).toBeLessThan(1e-9);
      expect(Math.abs(mt.z - th.z)).toBeLessThan(1e-9);
      expect(Math.abs(mt.w - th.w)).toBeLessThan(1e-9);
    }
  });

  it('Quaternion.multiplyQuaternions matches three.js', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const a = randomUnitQuat(rng);
      const b = randomUnitQuat(rng);
      const mt = new MQ().multiplyQuaternions(
        new MQ(a.x, a.y, a.z, a.w),
        new MQ(b.x, b.y, b.z, b.w),
      );
      const th = new TQ().multiplyQuaternions(a.clone(), b.clone());
      expect(Math.abs(mt.x - th.x)).toBeLessThan(1e-12);
      expect(Math.abs(mt.y - th.y)).toBeLessThan(1e-12);
      expect(Math.abs(mt.z - th.z)).toBeLessThan(1e-12);
      expect(Math.abs(mt.w - th.w)).toBeLessThan(1e-12);
    }
  });

  it('Vector3.applyQuaternion matches three.js', () => {
    const rng = makeRng(1234);
    for (let i = 0; i < 200; i++) {
      const q = randomUnitQuat(rng);
      const v = new T3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      const mt = new M3(v.x, v.y, v.z).applyQuaternion(new MQ(q.x, q.y, q.z, q.w));
      const th = v.clone().applyQuaternion(q);
      expect(close(mt.x, th.x, 1e-9)).toBe(true);
      expect(close(mt.y, th.y, 1e-9)).toBe(true);
      expect(close(mt.z, th.z, 1e-9)).toBe(true);
    }
  });

  it('normalize / length / dot / cross match three.js', () => {
    const rng = makeRng(555);
    for (let i = 0; i < 200; i++) {
      const a = new T3(rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2);
      const b = new T3(rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2);
      const ma = new M3(a.x, a.y, a.z);
      const mb = new M3(b.x, b.y, b.z);
      expect(Math.abs(ma.length() - a.length())).toBeLessThan(1e-12);
      expect(Math.abs(ma.dot(mb) - a.dot(b))).toBeLessThan(1e-12);
      // NOTE: three.js Vector3.cross() MUTATES in place and returns this.
      // math3d's cross() returns a NEW vector (documented divergence).
      const mc = ma.cross(mb);
      const tc = a.clone().cross(b);
      expect(Math.abs(mc.x - tc.x)).toBeLessThan(1e-12);
      expect(Math.abs(mc.y - tc.y)).toBeLessThan(1e-12);
      expect(Math.abs(mc.z - tc.z)).toBeLessThan(1e-12);
      ma.normalize();
      a.normalize();
      expect(Math.abs(ma.x - a.x)).toBeLessThan(1e-12);
      expect(Math.abs(ma.y - a.y)).toBeLessThan(1e-12);
      expect(Math.abs(ma.z - a.z)).toBeLessThan(1e-12);
    }
  });

  it('zero-vector normalize is a safe no-op in both', () => {
    const m = new M3(0, 0, 0).normalize();
    const t = new T3(0, 0, 0).normalize();
    expect(m.x).toBe(t.x);
    expect(m.y).toBe(t.y);
    expect(m.z).toBe(t.z);
  });

  it('three Quaternion.copy() reads public x/y/z/w from a math3d quat', () => {
    // This is the exact cast used in Cube3DEngine.setCubeOrientation.
    const math3dQuat = new MQ(0.1, -0.2, 0.3, 0.923);
    const threeQuat = new TQ().copy(math3dQuat as unknown as TQ);
    expect(threeQuat.x).toBe(0.1);
    expect(threeQuat.y).toBe(-0.2);
    expect(threeQuat.z).toBe(0.3);
    expect(threeQuat.w).toBeCloseTo(0.923, 12);
    expect(Number.isNaN(threeQuat.x)).toBe(false);
    expect(Number.isNaN(threeQuat.w)).toBe(false);
  });

  it('three slerpQuaternions is finite AFTER copy()-conversion (NaN regression)', () => {
    // Regression guard for the Cube3DEngine animated setCubeOrientation bug:
    // three's slerp() reads the INTERNAL _x/_y/_z/_w fields directly, so a
    // bare math3d Quaternion (public x/y/z/w only) produced NaN. Converting
    // via new TQ().copy(math3dQuat) populates those fields and fixes it.
    const math3dQuat = new MQ(0.1, -0.2, 0.3, 0.923).normalize();
    const target = new TQ().copy(math3dQuat as unknown as TQ);
    const start = new TQ(0, 0, 0, 1);
    const result = new TQ().slerpQuaternions(start, target, 0.5);
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
    expect(Number.isNaN(result.z)).toBe(false);
    expect(Number.isNaN(result.w)).toBe(false);
    expect(result.length()).toBeGreaterThan(0.99);

    // Invariant lock: a BARE math3d quat passed to slerp must remain NaN —
    // if three ever starts reading the public getters, this test fails and
    // the copy()-conversion workaround can be simplified away.
    const broken = new TQ().slerpQuaternions(start, math3dQuat as unknown as TQ, 0.5);
    expect(Number.isNaN(broken.x)).toBe(true);
  });
});
