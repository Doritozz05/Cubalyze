/**
 * Nivel 2 — Edge cases para Cube2x2State
 *
 * Casos frontera:
 * • applySequence con strings vacíos, nulos, malformados
 * • Movimientos D, L, B delegados a CubeState 3x3
 * • clone() y reset() en estados scrambled
 * • invertNotation con entradas inválidas
 * • isSolved con estados corruptos
 * • applyMove con todos los 18 movimientos
 */
import { describe, it, expect } from 'vitest';
import { Cube2x2State, Move2x2, StringToMove2x2 } from '../Cube2x2State';

describe('Cube2x2State — Nivel 2 Edge Cases', () => {
  // ── Constructor ────────────────────────────────────────────────────

  it('constructor sin args crea estado resuelto', () => {
    const s = new Cube2x2State();
    expect(s.isSolved()).toBe(true);
    expect(s.cp).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(s.co).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('constructor con cp/co personalizados', () => {
    const cp = [3, 0, 1, 2, 4, 5, 6, 7];
    const co = [0, 0, 0, 0, 0, 0, 0, 0];
    const s = new Cube2x2State(cp, co);
    expect(Array.from(s.cp)).toEqual(cp);
    expect(Array.from(s.co)).toEqual(co);
  });

  it('constructor con cp undefined y co undefined', () => {
    const s = new Cube2x2State(undefined, undefined);
    expect(s.isSolved()).toBe(true);
  });

  // ── applySequence: strings vacíos y malformados ────────────────────

  it('applySequence con string vacío no cambia estado', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.U1); // scrambled
    const before = s.clone();
    s.applySequence('');
    expect(Array.from(s.cp)).toEqual(Array.from(before.cp));
    expect(Array.from(s.co)).toEqual(Array.from(before.co));
  });

  it('applySequence con espacios no cambia estado', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.R1);
    const before = s.clone();
    s.applySequence('   ');
    expect(Array.from(s.cp)).toEqual(Array.from(before.cp));
  });

  it('applySequence con solo espacios y tabs', () => {
    const s = new Cube2x2State();
    s.applySequence('\t \n  ');
    expect(s.isSolved()).toBe(true);
  });

  it('applySequence con un solo movimiento bien formado', () => {
    const s = new Cube2x2State();
    s.applySequence("U");
    expect(s.isSolved()).toBe(false);
    s.applySequence("U'");
    expect(s.isSolved()).toBe(true);
  });

  // ── applySequence: movimientos que NO existen ──────────────────────

  it('applySequence con token que no existe en StringToMove2x2 lanza error', () => {
    const s = new Cube2x2State();
    expect(() => s.applySequence('X')).toThrow();
  });

  it('applySequence con token numérico lanza error', () => {
    const s = new Cube2x2State();
    expect(() => s.applySequence('123')).toThrow();
  });

  // ── D, L, B moves delegados a CubeState 3x3 ────────────────────────

  it('applySequence con D move (delegado a 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("D");
    expect(s.isSolved()).toBe(false);
    // D mueve la capa inferior: los 4 corners D cambian de posición
    expect(s.cp[6]).not.toBe(6); // DBL se mueve
  });

  it('applySequence con L move', () => {
    const s = new Cube2x2State();
    s.applySequence("L");
    expect(s.isSolved()).toBe(false);
  });

  it('applySequence con B move', () => {
    const s = new Cube2x2State();
    s.applySequence("B");
    expect(s.isSolved()).toBe(false);
  });

  it('D + D + D + D = solved (4 D vuelven al inicio)', () => {
    const s = new Cube2x2State();
    s.applySequence("D D D D");
    expect(s.isSolved()).toBe(true);
  });

  // ── Movimientos compuestos URF (nativos) ───────────────────────────

  it('U R F aplicados en secuencia mantienen cp[6] = 6 (DBL fijo)', () => {
    const s = new Cube2x2State();
    s.applySequence("U R F U2 R' F'");
    expect(s.cp[6]).toBe(6); // DBL no se mueve con URF
  });

  it('U + U + U + U = 4U vuelve al inicio', () => {
    const s = new Cube2x2State();
    s.applySequence("U U U U");
    // 4 x U = ciclo completo de 360°
    expect(s.isSolved()).toBe(true);
  });

  it('R + R\' = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("R R'");
    expect(s.isSolved()).toBe(true);
  });

  it('F4 (F F F F) = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("F F F F");
    expect(s.isSolved()).toBe(true);
  });

  // ── Movimientos extendidos (x, y, z, M, E, S) delegados a 3×3 ─────

  it('secuencia con y rotation (delegado a 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("y");
    // y rotation mueve todo el cubo, DBL cambia de posición
    expect(s.cp[6]).not.toBe(6);
  });

  it('applySequence con y rotation (delegado a CubeState 3×3)', () => {
    const s = new Cube2x2State();
    s.applySequence("y");
    expect(s.cp[6]).not.toBe(6); // DBL se mueve con rotación global
    // y + y + y + y = 4 rotaciones vuelven al original
    s.applySequence("y y y");
    expect(s.isSolved()).toBe(true);
  });

  it('x rotation cambia los corners', () => {
    const s = new Cube2x2State();
    s.applySequence("x");
    expect(s.isSolved()).toBe(false);
  });

  it('x + x + x + x = solved', () => {
    const s = new Cube2x2State();
    s.applySequence("x x x x");
    expect(s.isSolved()).toBe(true);
  });

  it('z rotation', () => {
    const s = new Cube2x2State();
    s.applySequence("z");
    expect(s.isSolved()).toBe(false);
  });

  // ── clone() ────────────────────────────────────────────────────────

  it('clone() produce un estado independiente', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.R1);
    const c = s.clone();
    c.applyMove(Move2x2.U1);
    expect(Array.from(s.cp)).not.toEqual(Array.from(c.cp));
  });

  it('clone() de estado resuelto es resuelto', () => {
    const s = new Cube2x2State();
    expect(s.clone().isSolved()).toBe(true);
  });

  it('clone() después de secuencia larga', () => {
    const s = new Cube2x2State();
    s.applySequence("R U R' U' R' F R F'");
    const c = s.clone();
    expect(Array.from(s.cp)).toEqual(Array.from(c.cp));
    expect(Array.from(s.co)).toEqual(Array.from(c.co));
  });

  // ── reset() ────────────────────────────────────────────────────────

  it('reset() vuelve al estado resuelto', () => {
    const s = new Cube2x2State();
    s.applySequence("R U R' F2 U2 R' F'");
    expect(s.isSolved()).toBe(false);
    s.reset();
    expect(s.isSolved()).toBe(true);
  });

  it('reset() dos veces seguidas es seguro', () => {
    const s = new Cube2x2State();
    s.applyMove(Move2x2.F1);
    s.reset();
    s.reset();
    expect(s.isSolved()).toBe(true);
  });

  // ── isSolved() ─────────────────────────────────────────────────────

  it('isSolved detecta twisted corner (co[3] = 1)', () => {
    const s = new Cube2x2State();
    s.co[3] = 1; // Manually twist one corner
    expect(s.isSolved()).toBe(false);
  });

  it('isSolved detecta corner intercambiado (cp[0]=1, cp[1]=0)', () => {
    const s = new Cube2x2State();
    s.cp[0] = 1;
    s.cp[1] = 0;
    expect(s.isSolved()).toBe(false);
  });

  // ── invertNotation ─────────────────────────────────────────────────

  it('invertNotation invierte secuencia correctamente', () => {
    const result = Cube2x2State.invertNotation("R U R'");
    expect(result).toBe("R U' R'");
  });

  it('invertNotation con secuencia vacía devuelve vacío', () => {
    expect(Cube2x2State.invertNotation("")).toBe("");
  });

  it('invertNotation con espacios devuelve vacío', () => {
    expect(Cube2x2State.invertNotation("  ")).toBe("");
  });

  it('invertNotation con token inválido lanza error', () => {
    expect(() => Cube2x2State.invertNotation("X")).toThrow();
  });

  it('invertNotation round-trip: apply(invert(s)) = solved', () => {
    const scramble = "R U R' F2 U2 R' F'";
    const inv = Cube2x2State.invertNotation(scramble);
    const s = new Cube2x2State();
    s.applySequence(scramble);
    s.applySequence(inv);
    expect(s.isSolved()).toBe(true);
  });

  it('invertNotation con U2 mantiene U2', () => {
    expect(Cube2x2State.invertNotation("U2")).toBe("U2");
  });

  // ── applyMove: todos los 18 movimientos ────────────────────────────

  it('applyMove con cada uno de los 18 movimientos no lanza error', () => {
    for (let m = 0; m < 18; m++) {
      const s = new Cube2x2State();
      expect(() => s.applyMove(m as Move2x2)).not.toThrow();
      // Después de aplicar y deshacer, debe volver a solved
      const inv = Cube2x2State.inverseMove(m as Move2x2);
      s.applyMove(inv);
      expect(s.isSolved()).toBe(true);
    }
  });

  // ── inverseMove + moveToNotation ───────────────────────────────────

  it('inverseMove: U1 ↔ U3', () => {
    expect(Cube2x2State.inverseMove(Move2x2.U1)).toBe(Move2x2.U3);
    expect(Cube2x2State.inverseMove(Move2x2.U3)).toBe(Move2x2.U1);
  });

  it('inverseMove: U2 ↔ U2 (self-inverse)', () => {
    expect(Cube2x2State.inverseMove(Move2x2.U2)).toBe(Move2x2.U2);
  });

  it('moveToNotation: 0→U, 1→U2, 2→U\'', () => {
    expect(Cube2x2State.moveToNotation(Move2x2.U1)).toBe('U');
    expect(Cube2x2State.moveToNotation(Move2x2.U2)).toBe('U2');
    expect(Cube2x2State.moveToNotation(Move2x2.U3)).toBe("U'");
  });

  // ── StringToMove2x2: validación exhaustiva ─────────────────────────

  it('StringToMove2x2 tiene 18 entradas + 6 alias (U3, R3, F3, D3, L3, B3)', () => {
    const expected = [
      'U', 'U2', "U'", 'U3',
      'R', 'R2', "R'", 'R3',
      'F', 'F2', "F'", 'F3',
      'D', 'D2', "D'", 'D3',
      'L', 'L2', "L'", 'L3',
      'B', 'B2', "B'", 'B3',
    ];
    for (const key of expected) {
      expect(StringToMove2x2[key]).toBeDefined();
    }
  });

  // ── Estados extremos ───────────────────────────────────────────────

  it('superflip 2×2 (6 movimientos) no está resuelto', () => {
    // Superflip-like state on 2×2: R U2 R' U' R U2 R' F R' F'
    const s = new Cube2x2State();
    s.applySequence("R U2 R' U' R U2 R' F R' F'");
    expect(s.isSolved()).toBe(false);
  });

  it('18 movimientos URF cada uno aplicado una vez vuelve a solved', () => {
    // Aplicar cada uno de los 9 movimientos URF una vez, luego sus inversos
    const moves = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
    const inverse = ["U'", 'U2', 'U', "R'", 'R2', 'R', "F'", 'F2', 'F'];
    const s = new Cube2x2State();
    for (const m of moves) s.applySequence(m);
    for (const m of inverse.reverse()) s.applySequence(m);
    expect(s.isSolved()).toBe(true);
  });
});
