import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  PYRAMINX_CANONICAL_QUAT,
  PYRAMINX_GRIP_MAPS,
  PYRAMINX_GRIP_QUATERNIONS,
  PYRAMINX_INVERSE_GRIP,
  PYRAMINX_TILT_AXIS,
  conjugatePyraminxToken,
  snapPyraminxGrip,
  type PyraminxVertex,
} from '../PyraminxGeometry';

describe('Pyraminx Phase 2 — Grip Table & Keyboard Conjugation', () => {
  const TOKENS = [
    'U', "U'", 'L', "L'", 'R', "R'", 'B', "B'",
    'u', "u'", 'l', "l'", 'r', "r'", 'b', "b'",
  ] as const;

  it('1. Orbit of canonical quat generates 12 distinct unit quaternions', () => {
    expect(PYRAMINX_GRIP_QUATERNIONS).toHaveLength(12);

    // Each quaternion is normalized:
    for (let i = 0; i < 12; i++) {
      const q = PYRAMINX_GRIP_QUATERNIONS[i];
      expect(q.length()).toBeCloseTo(1, 6);
    }

    // All 12 quaternions are mutually distinct in SO(3) (max |dot| < 0.99 for i != j):
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const qi = PYRAMINX_GRIP_QUATERNIONS[i];
        const qj = PYRAMINX_GRIP_QUATERNIONS[j];
        const dot = Math.abs(qi.x * qj.x + qi.y * qj.y + qi.z * qj.z + qi.w * qj.w);
        expect(dot).toBeLessThan(0.95);
      }
    }
  });

  it('2. Snaps canonical quat to Grip 0 with confidence ~1.0', () => {
    const res = snapPyraminxGrip(PYRAMINX_CANONICAL_QUAT);
    expect(res.grip).toBe(0);
    expect(res.confidence).toBeCloseTo(1, 6);
  });

  it('3. Each of the 6 UI rotations lands on its expected grip index (0..5)', () => {
    const qY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (120 * Math.PI) / 180);
    const qX = new Quaternion().setFromAxisAngle(PYRAMINX_TILT_AXIS, Math.PI);

    const p0 = PYRAMINX_CANONICAL_QUAT.clone();
    const p1 = qY.clone().multiply(p0).normalize();
    const p2 = qY.clone().multiply(p1).normalize();
    const p3 = qX.clone().multiply(p0).normalize();
    const p4 = qX.clone().multiply(p1).normalize();
    const p5 = qX.clone().multiply(p2).normalize();

    expect(snapPyraminxGrip(p0).grip).toBe(0);
    expect(snapPyraminxGrip(p1).grip).toBe(1);
    expect(snapPyraminxGrip(p2).grip).toBe(2);
    expect(snapPyraminxGrip(p3).grip).toBe(3);
    expect(snapPyraminxGrip(p4).grip).toBe(4);
    expect(snapPyraminxGrip(p5).grip).toBe(5);
  });

  it('4. Screen conjugation mappings are valid bijections on vertices', () => {
    expect(PYRAMINX_GRIP_MAPS).toHaveLength(12);

    for (let g = 0; g < 12; g++) {
      const map = PYRAMINX_GRIP_MAPS[g];
      const targets = [map.U, map.L, map.R, map.B];
      const distinct = new Set(targets);
      expect(distinct.size).toBe(4);
    }
  });

  it('5. Conjugates key tokens correctly preserving primes and case (tips)', () => {
    // Grip 0 is identity:
    expect(conjugatePyraminxToken('U', 0)).toBe('U');
    expect(conjugatePyraminxToken("U'", 0)).toBe("U'");
    expect(conjugatePyraminxToken('u', 0)).toBe('u');
    expect(conjugatePyraminxToken("u'", 0)).toBe("u'");
    expect(conjugatePyraminxToken('L', 0)).toBe('L');
    expect(conjugatePyraminxToken("R'", 0)).toBe("R'");
    expect(conjugatePyraminxToken('b', 0)).toBe('b');

    // Grip 3 (tilt: U <-> B, L <-> R):
    expect(conjugatePyraminxToken('U', 3)).toBe('B');
    expect(conjugatePyraminxToken("U'", 3)).toBe("B'");
    expect(conjugatePyraminxToken('u', 3)).toBe('b');
    expect(conjugatePyraminxToken("u'", 3)).toBe("b'");
    expect(conjugatePyraminxToken('L', 3)).toBe('R');
    expect(conjugatePyraminxToken("L'", 3)).toBe("R'");
    expect(conjugatePyraminxToken('R', 3)).toBe('L');
    expect(conjugatePyraminxToken('B', 3)).toBe('U');
  });

  it('6. Conjugation is involutive with respect to the inverse grip', () => {
    for (let g = 0; g < 12; g++) {
      const gInv = PYRAMINX_INVERSE_GRIP[g];

      for (const t of TOKENS) {
        const forward = conjugatePyraminxToken(t, g);
        const back = conjugatePyraminxToken(forward, gInv);
        expect(back).toBe(t);
      }
    }
  });
});
