import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  PYRAMINX_CANONICAL_QUAT,
  PYRAMINX_GRIP_MAPS,
  PYRAMINX_GRIP_QUATERNIONS,
  PYRAMINX_GRIP_TRANSITIONS,
  PYRAMINX_INVERSE_GRIP,
  PYRAMINX_ROTATION_OPS,
  PYRAMINX_TILT_AXIS,
  PYRAMINX_VERTEX_POSITIONS,
  computePyraminxIsometricBasis,
  conjugatePyraminxToken,
  displayPyraminxTokenThroughGrip,
  remapPyraminxScrambleString,
  snapPyraminxGrip,
  transitionPyraminxGrip,
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
    // Grip 0 = canonical view, WYSIWYG: the L vertex sits at the bottom-
    // RIGHT of the screen and the R vertex at the LEFT, so the "R" (right)
    // key turns the canonical L layer and the "L" (left) key the canonical
    // R layer — the keys match the screen positions, like the cube.
    expect(conjugatePyraminxToken('U', 0)).toBe('U');
    expect(conjugatePyraminxToken("U'", 0)).toBe("U'");
    expect(conjugatePyraminxToken('u', 0)).toBe('u');
    expect(conjugatePyraminxToken("u'", 0)).toBe("u'");
    expect(conjugatePyraminxToken('L', 0)).toBe('R');
    expect(conjugatePyraminxToken("R'", 0)).toBe("L'");
    expect(conjugatePyraminxToken('b', 0)).toBe('b');

    // Grip 3 (tilt: B tip on top, U tip at the back; L/R keep their sides):
    expect(conjugatePyraminxToken('U', 3)).toBe('B');
    expect(conjugatePyraminxToken("U'", 3)).toBe("B'");
    expect(conjugatePyraminxToken('u', 3)).toBe('b');
    expect(conjugatePyraminxToken("u'", 3)).toBe("b'");
    expect(conjugatePyraminxToken('L', 3)).toBe('L');
    expect(conjugatePyraminxToken("L'", 3)).toBe("L'");
    expect(conjugatePyraminxToken('R', 3)).toBe('R');
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

  it('7. Display remap is the inverse of keyboard conjugation (WYSIWYG)', () => {
    // The scramble display names the VIEW position where a canonical vertex
    // now sits; pressing that position key performs the canonical move the
    // display names — so display then conjugate must round-trip to the
    // original canonical token, for every grip and every token.
    for (let g = 0; g < 12; g++) {
      for (const t of TOKENS) {
        const shown = displayPyraminxTokenThroughGrip(t, g);
        const performed = conjugatePyraminxToken(shown, g);
        expect(performed).toBe(t);
      }
    }
  });

  it('8. Known display mappings: canonical grip 0 and rotY grip 1', () => {
    // Grip 0 (canonical view): the display names the SCREEN POSITION where
    // each canonical vertex actually sits — the canonical R vertex is at the
    // left position and the canonical L vertex at the right position, so a
    // canonical "R" displays as "L" and a canonical "L" as "R". This is the
    // WYSIWYG fix: turning the layer you see at the right shows "R", exactly
    // like the cube (whose canonical view happens to align with the letters).
    expect(displayPyraminxTokenThroughGrip('U', 0)).toBe('U');
    expect(displayPyraminxTokenThroughGrip("R'", 0)).toBe("L'");
    expect(displayPyraminxTokenThroughGrip('u', 0)).toBe('u');
    expect(displayPyraminxTokenThroughGrip("l'", 0)).toBe("r'");

    // Grip 1 (rotatePuzzleY(1)): canonical R sits at the bottom-RIGHT and
    // canonical B at the LEFT — the scramble "R" reads as "R" (the right
    // position), "B" as "L".
    expect(displayPyraminxTokenThroughGrip('R', 1)).toBe('R');
    expect(displayPyraminxTokenThroughGrip("R'", 1)).toBe("R'");
    expect(displayPyraminxTokenThroughGrip('B', 1)).toBe('L');
    expect(displayPyraminxTokenThroughGrip("L'", 1)).toBe("B'");
    expect(displayPyraminxTokenThroughGrip('U', 1)).toBe('U');
    expect(displayPyraminxTokenThroughGrip('r', 1)).toBe('r');
    expect(displayPyraminxTokenThroughGrip("u'", 1)).toBe("u'");
  });

  it('9. remapPyraminxScrambleString preserves count, primes and case', () => {
    const scramble = "U L' B R' u l'";
    // Grip 0 is NOT identity: the canonical view is mirrored vs the WCA hold
    // (the L vertex sits bottom-right, R at the left), so the display renames
    // canonical L↔R to the screen positions: L'→R', R'→L'. WYSIWYG — the
    // displayed letters match what the user sees and does.
    expect(remapPyraminxScrambleString(scramble, 0)).toBe("U R' B L' u r'");

    const remapped = remapPyraminxScrambleString(scramble, 1);
    expect(remapped.split(' ')).toHaveLength(6);
    // Primes and tips survive the remap (grip 1: R→R, B→L, L→B, U→U).
    expect(remapped).toBe("U B' L R' u b'");

    // Unknown tokens pass through unchanged.
    expect(remapPyraminxScrambleString('U x z', 1)).toBe('U x z');
  });

  it('10. Grip transition table: UI rotations are deterministic and closed on A₄', () => {
    expect(PYRAMINX_GRIP_TRANSITIONS.y1).toHaveLength(12);
    // Lateral 120° steps cycle the three upright poses: 0→1→2→0.
    expect(transitionPyraminxGrip(0, 'y1')).toBe(1);
    expect(transitionPyraminxGrip(1, 'y1')).toBe(2);
    expect(transitionPyraminxGrip(2, 'y1')).toBe(0);
    // Inverse lateral steps undo them.
    expect(transitionPyraminxGrip(0, 'y-1')).toBe(2);
    expect(transitionPyraminxGrip(2, 'y-1')).toBe(1);
    // The 180° C2 tilt is self-inverse: 0↔3, 1↔4, 2↔5.
    expect(transitionPyraminxGrip(0, 'x1')).toBe(3);
    expect(transitionPyraminxGrip(3, 'x1')).toBe(0);
    expect(transitionPyraminxGrip(1, 'x1')).toBe(4);
    expect(transitionPyraminxGrip(4, 'x1')).toBe(1);
    expect(transitionPyraminxGrip(2, 'x1')).toBe(5);
    expect(transitionPyraminxGrip(5, 'x1')).toBe(2);
    // Every op maps every grip to a valid grip (closed on the 12 poses).
    for (let g = 0; g < 12; g++) {
      for (const op of PYRAMINX_ROTATION_OPS) {
        const next = transitionPyraminxGrip(g, op);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(12);
      }
    }
  });

  it('11. Applying a rotation then its inverse returns to the same grip', () => {
    for (let g = 0; g < 12; g++) {
      expect(transitionPyraminxGrip(transitionPyraminxGrip(g, 'y1'), 'y-1')).toBe(g);
      expect(transitionPyraminxGrip(transitionPyraminxGrip(g, 'y-1'), 'y1')).toBe(g);
      // The tilt is its own inverse, so x1∘x1 = x-1∘x-1 = identity.
      expect(transitionPyraminxGrip(transitionPyraminxGrip(g, 'x1'), 'x1')).toBe(g);
      expect(transitionPyraminxGrip(transitionPyraminxGrip(g, 'x-1'), 'x-1')).toBe(g);
    }
  });

  it('12. x1 and x-1 land on the same pose (180° tilt is its own inverse)', () => {
    for (let g = 0; g < 12; g++) {
      expect(transitionPyraminxGrip(g, 'x1')).toBe(transitionPyraminxGrip(g, 'x-1'));
    }
  });

  it('13. Grip maps match the ACTUAL screen geometry (WYSIWYG — no mirror)', () => {
    // For every pose, the map must name the canonical vertex that physically
    // projects onto each screen position (top / back / front-left / front-
    // right) under the canonical isometric camera. This is the invariant the
    // old hand-authored table violated: it assumed the canonical view mirrors
    // the WCA hold (L left / R right) when the pose actually puts the L
    // vertex at the bottom-right and the R vertex at the left — which
    // inverted every displayed/keyboard letter. Independent re-derivation
    // from the pose quaternions + the real camera keeps the tables honest.
    const { forward, right, up } = computePyraminxIsometricBasis();
    const sU = (p: Vector3) => p.dot(up);
    const sR = (p: Vector3) => p.dot(right);
    const depth = (p: Vector3) => p.dot(forward);

    for (let g = 0; g < 12; g++) {
      const gq = PYRAMINX_GRIP_QUATERNIONS[g];
      const world = (v: PyraminxVertex) =>
        PYRAMINX_VERTEX_POSITIONS[v].clone().applyQuaternion(gq);
      const tips = (['U', 'L', 'R', 'B'] as const).map((v) => ({ v, p: world(v) }));

      const top = tips.reduce((a, b) => (sU(a.p) > sU(b.p) ? a : b)).v;
      const base = tips.filter((t) => t.v !== top);
      const back = base.reduce((a, b) => (depth(a.p) > depth(b.p) ? a : b)).v;
      const front = base.filter((t) => t.v !== back);
      const left = front.reduce((a, b) => (sR(a.p) < sR(b.p) ? a : b)).v;
      const rightVertex = front.reduce((a, b) => (sR(a.p) > sR(b.p) ? a : b)).v;

      expect(PYRAMINX_GRIP_MAPS[g].U).toBe(top);
      expect(PYRAMINX_GRIP_MAPS[g].L).toBe(left);
      expect(PYRAMINX_GRIP_MAPS[g].R).toBe(rightVertex);
      expect(PYRAMINX_GRIP_MAPS[g].B).toBe(back);
    }
  });
});
