import { describe, it, expect } from 'vitest';
import { CubeState, FaceletStringConverter } from '../index';
import { Move, Edge, Corner } from '../Constants';

describe('CubeState — Extended Moves (M, E, S, x, y, z)', () => {
  // ── Basic execution: no throw ──────────────────────────────────────

  it('M move executes without error', () => {
    const c = new CubeState();
    expect(() => c.applySequence('M')).not.toThrow();
    expect(c.isSolved()).toBe(false);
  });

  it('M2 move executes without error', () => {
    const c = new CubeState();
    expect(() => c.applySequence('M2')).not.toThrow();
    expect(c.isSolved()).toBe(false);
  });

  it("M' move executes without error", () => {
    const c = new CubeState();
    expect(() => c.applySequence("M'")).not.toThrow();
    expect(c.isSolved()).toBe(false);
  });

  it('E move executes without error', () => {
    const c = new CubeState();
    expect(() => c.applySequence('E')).not.toThrow();
  });

  it('S move executes without error', () => {
    const c = new CubeState();
    expect(() => c.applySequence('S')).not.toThrow();
  });

  it('x rotation executes without error (changes cubie positions, not solved)', () => {
    const c = new CubeState();
    expect(() => c.applySequence('x')).not.toThrow();
    // x = R L' M' moves pieces to different positions — not identity in cubie model
    expect(c.isSolved()).toBe(false);
  });

  it('y rotation executes without error (changes cubie positions, not solved)', () => {
    const c = new CubeState();
    expect(() => c.applySequence('y')).not.toThrow();
    expect(c.isSolved()).toBe(false);
  });

  it('z rotation executes without error (changes cubie positions, not solved)', () => {
    const c = new CubeState();
    expect(() => c.applySequence('z')).not.toThrow();
    expect(c.isSolved()).toBe(false);
  });

  it("x' and x2 execute without error", () => {
    const c1 = new CubeState();
    expect(() => c1.applySequence("x'")).not.toThrow();
    const c2 = new CubeState();
    expect(() => c2.applySequence('x2')).not.toThrow();
  });

  // ── Mathematical properties ────────────────────────────────────────

  it('M4 returns to solved (4 quarter turns = identity)', () => {
    const c = new CubeState();
    c.applySequence('M M M M');
    expect(c.isSolved()).toBe(true);
  });

  it('M M\' cancels out (returns to solved)', () => {
    const c = new CubeState();
    c.applySequence("M M'");
    expect(c.isSolved()).toBe(true);
  });

  it('M2 M2 = identity', () => {
    const c = new CubeState();
    c.applySequence('M2 M2');
    expect(c.isSolved()).toBe(true);
  });

  it('E4 returns to solved', () => {
    const c = new CubeState();
    c.applySequence('E E E E');
    expect(c.isSolved()).toBe(true);
  });

  it('S4 returns to solved', () => {
    const c = new CubeState();
    c.applySequence('S S S S');
    expect(c.isSolved()).toBe(true);
  });

  it('x4 returns to solved', () => {
    const c = new CubeState();
    c.applySequence('x x x x');
    expect(c.isSolved()).toBe(true);
  });

  it('y4 returns to solved', () => {
    const c = new CubeState();
    c.applySequence('y y y y');
    expect(c.isSolved()).toBe(true);
  });

  it('z4 returns to solved', () => {
    const c = new CubeState();
    c.applySequence('z z z z');
    expect(c.isSolved()).toBe(true);
  });

  it('x x\' = identity', () => {
    const c = new CubeState();
    c.applySequence("x x'");
    expect(c.isSolved()).toBe(true);
  });

  // ── M-slice permutation correctness ────────────────────────────────
  // M = like L. Cycles edges: UF→UB→DB→DF→UF (piece at UF goes to UB position)
  // After M: ep should be [UR, UB, UL, DB, DR, UF, DL, DF, FR, FL, BL, BR]

  it('M cycles the correct edges', () => {
    const c = new CubeState();
    c.applyMove(Move.M1);
    // After M: position 1 (UF) has piece UB(3), position 3(UB) has piece DB(7),
    //          position 5(DF) has piece UF(1), position 7(DB) has piece DF(5)
    expect(c.ep[1]).toBe(Edge.UB);  // UF position ← UB piece
    expect(c.ep[3]).toBe(Edge.DB);  // UB position ← DB piece
    expect(c.ep[5]).toBe(Edge.UF);  // DF position ← UF piece
    expect(c.ep[7]).toBe(Edge.DF);  // DB position ← DF piece
    // Other edges unchanged
    expect(c.ep[0]).toBe(Edge.UR);
    expect(c.ep[8]).toBe(Edge.FR);
  });

  it('M does not affect corners', () => {
    const c = new CubeState();
    c.applyMove(Move.M1);
    for (let i = 0; i < 8; i++) {
      expect(c.cp[i]).toBe(i);
      expect(c.co[i]).toBe(0);
    }
  });

  it('M flips the 4 cycled edges (UF, UB, DF, DB) — the rest unchanged', () => {
    const c = new CubeState();
    c.applyMove(Move.M1);
    // M rotates the M-slice 90°; for each cycled edge, its U/D color rotates
    // onto the F/B face, which under Kociemba's eo convention = flip (eo=1).
    expect(c.eo[1]).toBe(1);  // UF flipped
    expect(c.eo[3]).toBe(1);  // UB flipped
    expect(c.eo[5]).toBe(1);  // DF flipped
    expect(c.eo[7]).toBe(1);  // DB flipped
    // Other edges not affected by M
    expect(c.eo[0]).toBe(0);  // UR
    expect(c.eo[2]).toBe(0);  // UL
    expect(c.eo[4]).toBe(0);  // DR
    expect(c.eo[6]).toBe(0);  // DL
    expect(c.eo[8]).toBe(0);  // FR
    expect(c.eo[9]).toBe(0);  // FL
    expect(c.eo[10]).toBe(0); // BL
    expect(c.eo[11]).toBe(0); // BR
  });

  it('M2 flips every cycled edge twice — net eo=0 for those 4 slots', () => {
    const c = new CubeState();
    c.applyMove(Move.M2);
    // M2 = M * M: each cycled edge flips twice → back to oriented.
    for (let i = 0; i < 12; i++) {
      expect(c.eo[i]).toBe(0);
    }
  });

  // ── E-slice permutation correctness ────────────────────────────────
  // E = like D. Cycles: FR→BR→BL→FL→FR
  // After E: ep[8]=FL(9), ep[9]=BL(10), ep[10]=BR(11), ep[11]=FR(8)

  it('E cycles the correct edges', () => {
    const c = new CubeState();
    c.applyMove(Move.E1);
    expect(c.ep[8]).toBe(Edge.FL);   // FR position ← FL piece
    expect(c.ep[9]).toBe(Edge.BL);   // FL position ← BL piece
    expect(c.ep[10]).toBe(Edge.BR);  // BL position ← BR piece
    expect(c.ep[11]).toBe(Edge.FR);  // BR position ← FR piece
  });

  it('E flips the 4 cycled edges (FR, FL, BL, BR) — the rest unchanged', () => {
    const c = new CubeState();
    c.applyMove(Move.E1);
    // E rotates the E-slice 90°; each cycled edge's F/B color rotates onto
    // the U/D face = eo flip under Kociemba convention.
    expect(c.eo[8]).toBe(1);  // FR flipped
    expect(c.eo[9]).toBe(1);  // FL flipped
    expect(c.eo[10]).toBe(1); // BL flipped
    expect(c.eo[11]).toBe(1); // BR flipped
    // Other edges not affected by E
    expect(c.eo[0]).toBe(0);  // UR
    expect(c.eo[1]).toBe(0);  // UF
    expect(c.eo[2]).toBe(0);  // UL
    expect(c.eo[3]).toBe(0);  // UB
    expect(c.eo[4]).toBe(0);  // DR
    expect(c.eo[5]).toBe(0);  // DF
    expect(c.eo[6]).toBe(0);  // DL
    expect(c.eo[7]).toBe(0);  // DB
  });

  // ── S-slice permutation correctness ────────────────────────────────
  // S = like F. Cycles: UR→DR→DL→UL→UR, flips all 4

  it('S cycles the correct edges', () => {
    const c = new CubeState();
    c.applyMove(Move.S1);
    expect(c.ep[0]).toBe(Edge.UL);  // UR position ← UL piece
    expect(c.ep[2]).toBe(Edge.DL);  // UL position ← DL piece
    expect(c.ep[4]).toBe(Edge.UR);  // DR position ← UR piece
    expect(c.ep[6]).toBe(Edge.DR);  // DL position ← DR piece
  });

  it('S flips the 4 cycled edges', () => {
    const c = new CubeState();
    c.applyMove(Move.S1);
    expect(c.eo[0]).toBe(1); // UR flipped
    expect(c.eo[2]).toBe(1); // UL flipped
    expect(c.eo[4]).toBe(1); // DR flipped
    expect(c.eo[6]).toBe(1); // DL flipped
    // Other edges not flipped
    expect(c.eo[1]).toBe(0); // UF
    expect(c.eo[8]).toBe(0); // FR
  });

  // ── Rotation correctness: x = R L' M' ──────────────────────────────

  it('x rotation = R L\' M\' (same cubie state)', () => {
    const viaRotation = new CubeState();
    viaRotation.applyMove(Move.X1);

    const viaComposite = new CubeState();
    viaComposite.applyMove(Move.R1);
    viaComposite.applyMove(Move.L3); // L'
    viaComposite.applyMove(Move.M3); // M'

    // Compare all cp/co/ep/eo
    for (let i = 0; i < 8; i++) {
      expect(viaRotation.cp[i]).toBe(viaComposite.cp[i]);
      expect(viaRotation.co[i]).toBe(viaComposite.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaRotation.ep[i]).toBe(viaComposite.ep[i]);
      expect(viaRotation.eo[i]).toBe(viaComposite.eo[i]);
    }
  });

  it('x4 = x * x * x * x returns to solved (including eo=0 for every edge)', () => {
    // Regression guard against silent eo drift in the rotation composite.
    // Even though M' in isolation flips 4 edges, the composite `x = R L' M'`
    // is applied 4 times here, so each cycled edge flips XOR 4 times = 0.
    // Uses only the public API: `isSolved()` (which compares against the
    // internal `SOLVED_EDGES`/`SOLVED_CORNERS` constants) plus a per-edge
    // `eo[i] === 0` loop to catch partial regressions.
    const c = new CubeState();
    c.applySequence('x x x x');
    expect(c.isSolved()).toBe(true);
    for (let i = 0; i < 12; i++) {
      expect(c.eo[i], `edge ${i} should have eo=0 after x4`).toBe(0);
    }
  });

  it('y rotation = U D\' E\' (same cubie state)', () => {
    const viaRotation = new CubeState();
    viaRotation.applyMove(Move.Y1);

    const viaComposite = new CubeState();
    viaComposite.applyMove(Move.U1);
    viaComposite.applyMove(Move.D3); // D'
    viaComposite.applyMove(Move.E3); // E'

    for (let i = 0; i < 8; i++) {
      expect(viaRotation.cp[i]).toBe(viaComposite.cp[i]);
      expect(viaRotation.co[i]).toBe(viaComposite.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaRotation.ep[i]).toBe(viaComposite.ep[i]);
      expect(viaRotation.eo[i]).toBe(viaComposite.eo[i]);
    }
  });

  it('z rotation = F B\' S (same cubie state)', () => {
    // The middle ring of a CW-from-+Z rotation cycles UR→DR→DL→UL→UR,
    // which is the S direction (NOT S'). The old S' composite reversed the
    // ring and was not a pure rotation (no consistent face map existed).
    const viaRotation = new CubeState();
    viaRotation.applyMove(Move.Z1);

    const viaComposite = new CubeState();
    viaComposite.applyMove(Move.F1);
    viaComposite.applyMove(Move.B3); // B'
    viaComposite.applyMove(Move.S1); // S

    for (let i = 0; i < 8; i++) {
      expect(viaRotation.cp[i]).toBe(viaComposite.cp[i]);
      expect(viaRotation.co[i]).toBe(viaComposite.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(viaRotation.ep[i]).toBe(viaComposite.ep[i]);
      expect(viaRotation.eo[i]).toBe(viaComposite.eo[i]);
    }
  });

  // ── All 21 PLL algorithms execute without error ────────────────────

  const PLL_ALGS: Array<[string, string]> = [
    ['Ua', "R U' R U R U R U' R' U' R2"],
    ['Ub', "R2 U R U R' U' R' U' R' U R'"],
    ['Z',  "M2 U M2 U M' U2 M2 U2 M' U2"],
    ['H',  'M2 U M2 U2 M2 U M2'],
    ['Aa', "x R' U R' D2 R U' R' D2 R2 x'"],
    ['Ab', "x R2 D2 R U R' D2 R U' R x'"],
    ['E',  "x' R U' R' D R U R' D' R U R' D R U' R' D' x"],
    ['T',  "R U R' U' R' F R2 U' R' U' R U R' F'"],
    ['F',  "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"],
    ['Ja', "R' U L' U2 R U' R' U2 R L U'"],
    ['Jb', "R U R' F' R U R' U' R' F R2 U' R' U'"],
    ['Ra', "R U' R' U' R U R D R' U' R D' R' U2 R' U'"],
    ['Rb', "R' U2 R U2 R' F R U R' U' R' F' R2 U'"],
    ['Y',  "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
    ['V',  "R' U R' U' y R' F' R2 U' R' U R' F R F"],
    ['Ga', "R2 U R' U R' U' R U' R2 D U' R' U R D'"],
    ['Gb', "R' U' R U D' R2 U R' U R U' R U' R2 D"],
    ['Gc', "R2 U' R U' R U R' U R2 D' U R U' R' D"],
    ['Gd', "R U R' U' D R2 U' R U' R' U R' U R2 D'"],
    ['Na', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"],
    ['Nb', "R' U R U' R' F' U' F R U R' F R' F' R U' R"],
  ];

  it('all 21 PLL algorithms execute without throwing', () => {
    for (const [name, alg] of PLL_ALGS) {
      const c = new CubeState();
      expect(() => c.applySequence(alg), `${name}: ${alg}`).not.toThrow();
    }
  });

  it('all 21 PLL algorithms produce non-solved states (they scramble from solved)', () => {
    for (const [name, alg] of PLL_ALGS) {
      const c = new CubeState();
      c.applySequence(alg);
      expect(c.isSolved(), `${name}: should not be solved after applying PLL alg to solved cube`).toBe(false);
    }
  });

  it('all 21 PLL algorithms + their inverse return to solved', () => {
    for (const [name, alg] of PLL_ALGS) {
      const c = new CubeState();
      c.applySequence(alg);
      // Apply inverse: reverse the moves and flip each suffix
      const tokens = alg.split(/\s+/);
      const inverse = tokens.reverse().map(t => {
        if (t.endsWith("'")) return t.slice(0, -1);
        if (t.endsWith('2')) return t;
        return t + "'";
      }).join(' ');
      c.applySequence(inverse);
      expect(c.isSolved(), `${name}: alg + inverse should return to solved`).toBe(true);
    }
  });

  // ── H perm and Z perm produce correct edge permutations ────────────

  it('H perm (M2 U M2 U2 M2 U M2) swaps opposite edges', () => {
    const c = new CubeState();
    c.applySequence('M2 U M2 U2 M2 U M2');
    // H perm: UR↔UL, UF↔UB
    expect(c.ep[0]).toBe(Edge.UL);  // UR ← UL
    expect(c.ep[2]).toBe(Edge.UR);  // UL ← UR
    expect(c.ep[1]).toBe(Edge.UB);  // UF ← UB
    expect(c.ep[3]).toBe(Edge.UF);  // UB ← UF
    // D-layer edges unchanged
    expect(c.ep[4]).toBe(Edge.DR);
    expect(c.ep[5]).toBe(Edge.DF);
  });

  it('Z perm (M2 U M2 U M\' U2 M2 U2 M\' U2) swaps adjacent edge pairs', () => {
    const c = new CubeState();
    c.applySequence("M2 U M2 U M' U2 M2 U2 M' U2");
    // Z perm: UR↔UF, UL↔UB
    expect(c.ep[0]).toBe(Edge.UF);  // UR ← UF
    expect(c.ep[1]).toBe(Edge.UR);  // UF ← UR
    expect(c.ep[2]).toBe(Edge.UB);  // UL ← UB
    expect(c.ep[3]).toBe(Edge.UL);  // UB ← UL
  });

  // ── Facelet generation from extended moves ─────────────────────────

  it('M2 produces valid 54-char facelet string', () => {
    const c = new CubeState();
    c.applySequence('M2');
    const facelets = FaceletStringConverter.toFaceletString(c);
    expect(facelets.length).toBe(54);
    // Centers should be unchanged
    expect(facelets[4]).toBe('U');
    expect(facelets[13]).toBe('R');
    expect(facelets[22]).toBe('F');
  });

  it('H perm facelets: U face all same, side colors permuted', () => {
    const c = new CubeState();
    c.applySequence('M2 U M2 U2 M2 U M2');
    const facelets = FaceletStringConverter.toFaceletString(c);
    // U face all U
    for (let i = 0; i < 9; i++) {
      expect(facelets[i]).toBe('U');
    }
    // D face all D
    for (let i = 27; i < 36; i++) {
      expect(facelets[i]).toBe('D');
    }
  });
});
