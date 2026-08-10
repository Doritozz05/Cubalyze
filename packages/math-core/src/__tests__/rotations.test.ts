import { describe, expect, it } from 'vitest';
import { CubeState, StateMatcher, F2LMask, FaceletStringConverter } from '../index';

/**
 * Regression tests for whole-cube rotations (x/y/z).
 *
 * The old composites (x = R·L'·M', y = U·D'·E', z = F·B'·S') had the right
 * piece permutation but inherited the slice moves' edge-flips/twists, so they
 * were NOT pure rotations: applying them to a solved cube scrambled the faces
 * (<x,y,z> generated 192 states instead of the 24-element rotation group).
 * The fix re-derives co/eo from the "solid faces" constraint.
 */

function signature(state: CubeState): string {
  return [
    Array.from(state.cp).join(','),
    Array.from(state.co).join(','),
    Array.from(state.ep).join(','),
    Array.from(state.eo).join(','),
  ].join('|');
}

function solidFaces(state: CubeState): boolean {
  // The cubie model has no center pieces: toFaceletString hardcodes each
  // face's center sticker to its face letter, so a rotated state shows the
  // old center color at the center. Ignore the 6 centers (index 4 of each
  // face) and require the remaining 8 stickers of each face to match.
  const f = FaceletStringConverter.toFaceletString(state);
  const faces = [0, 1, 2, 3, 4, 5].map((i) => f.slice(i * 9, i * 9 + 9));
  return faces.every((face) => {
    const nonCenter = face.split('').filter((_, idx) => idx !== 4);
    return new Set(nonCenter).size === 1;
  });
}

/** All 24 rotations as sequences over {x, y} (the rotation group generators). */
function rotationWords(): string[] {
  const seen = new Set<string>([signature(new CubeState())]);
  const queue: { seq: string; key: string }[] = [{ seq: '', key: signature(new CubeState()) }];
  const out: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur.seq);
    for (const m of ['x', 'y']) {
      const seq = (cur.seq + ' ' + m).trim();
      const s = new CubeState();
      s.applySequence(seq);
      const k = signature(s);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ seq, key: k });
      }
    }
  }
  return out;
}

describe('CubeState whole-cube rotations', () => {
  it('x, y and z applied to a solved cube leave every face monochromatic', () => {
    for (const move of ['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']) {
      const s = new CubeState();
      s.applySequence(move);
      expect(solidFaces(s), `${move} must keep faces solid`).toBe(true);
    }
  });

  it('x^4 = y^4 = z^4 = identity and r·r\u2032 = identity', () => {
    const id = signature(new CubeState());
    for (const move of ['x', 'y', 'z']) {
      const s = new CubeState();
      s.applySequence(`${move} ${move} ${move} ${move}`);
      expect(signature(s), `${move}^4`).toBe(id);
      const inv = new CubeState();
      inv.applySequence(`${move} ${move}'`);
      expect(signature(inv), `${move} ${move}'`).toBe(id);
    }
  });

  it('x, y, z generate exactly the 24-element rotation group', () => {
    const seen = new Set<string>([signature(new CubeState())]);
    const queue: { seq: string; key: string }[] = [{ seq: '', key: signature(new CubeState()) }];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const m of ['x', 'y', 'z']) {
        const seq = (cur.seq + ' ' + m).trim();
        const s = new CubeState();
        s.applySequence(seq);
        const k = signature(s);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ seq, key: k });
        }
      }
    }
    expect(seen.size).toBe(24);
  });

  it('every rotation preserves the orientation invariants (twist mod 3, flip mod 2)', () => {
    // NOTE: the face-move-group invariant sign(cp) == sign(ep) does NOT apply
    // to whole-cube rotations — rotations are NOT reachable by face turns, so
    // they live outside the face-move group and may (correctly) break that
    // parity relation. What rotations DO preserve are the orientation sums
    // (total corner twist ≡ 0 mod 3, total edge flip ≡ 0 mod 2), which is
    // exactly what distinguishes them from reflections of the cube.
    for (const w of rotationWords()) {
      const s = new CubeState();
      s.applySequence(w);
      const twist = Array.from(s.co).reduce((a, b) => a + b, 0);
      const flip = Array.from(s.eo).reduce((a, b) => a + b, 0);
      expect(twist % 3, `corner-twist invariant fails for '${w}'`).toBe(0);
      expect(flip % 2, `edge-flip invariant fails for '${w}'`).toBe(0);
    }
  });

  it('every rotation of the solved cube is F2L-complete up to rotation', () => {
    const words = rotationWords();
    expect(words.length).toBe(24);
    for (const w of words) {
      const s = new CubeState();
      s.applySequence(w);
      const ok = words.some((r) => {
        const t = s.clone();
        t.applySequence(r);
        return StateMatcher.matchesMask(t, F2LMask);
      });
      expect(ok, `F2L-invariant fails for rotation '${w}'`).toBe(true);
    }
  });

  it('z permutes the F layer like the F move and the B layer like B\u2032', () => {
    const z = new CubeState();
    z.applySequence('z');
    const ep = Array.from(z.ep);
    // F layer like F: FL(9)→UF(1), UF(1)→FR(8), FR(8)→DF(5), DF(5)→FL(9)
    expect(ep[1]).toBe(9);
    expect(ep[8]).toBe(1);
    expect(ep[5]).toBe(8);
    expect(ep[9]).toBe(5);
    // B layer like B': ULB(2)→UBR(3), UBR(3)→DRB(7), DRB(7)→DBL(6), DBL(6)→ULB(2)
    const cp = Array.from(z.cp);
    expect(cp[3]).toBe(2);
    expect(cp[7]).toBe(3);
    expect(cp[6]).toBe(7);
    expect(cp[2]).toBe(6);
  });

  it('rotations are consistent across a scrambled state (r then r\u2032)', () => {
    const s = new CubeState();
    s.applySequence("R U R' U' F' L F L'");
    for (const move of ['x', 'y', 'z']) {
      const t = s.clone();
      t.applySequence(`${move} ${move}'`);
      expect(signature(t)).toBe(signature(s));
    }
  });
});
