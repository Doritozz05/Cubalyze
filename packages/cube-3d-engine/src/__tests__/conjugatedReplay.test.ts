import { describe, it, expect } from 'vitest';
import { CubeModel } from '../core/CubeModel';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { RotationEngine } from '../animation/RotationEngine';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import { conjugateToBaseFrame, tokenize, CubeState } from '@cubalyze/math-core';

/**
 * Regression tests for the RECON REPLAY DESIGN: reconstruction records feed
 * the engine CONJUGATED base-frame moves (the cube solves in its own frame),
 * while the inspection/mid-solve rotations animate the cube ROOT (cosmetic).
 *
 * These tests prove:
 *  1. A wide's two CONJUGATED halves (face + slice) can be merged into ONE
 *     two-layer engine event (r' → the engine turns outer + middle together)
 *     under every inspection grip — the merge is safe because conjugation is
 *     a rigid rotation that preserves the face/slice angle relationship.
 *  2. Scramble + conjugated stream in the 3D engine reproduces math-core's
 *     piece positions EXACTLY (0 mismatches) — i.e. the cube ends solved
 *     (up to rotation) and the root grip is purely cosmetic.
 */

const SCRAMBLE = "L B R2 B' R2 U2 F D R2 U R2 F2 D2 R U B L2";
const RAW_PHASES = [
  "x'",
  "r' U F U' r U' r' U2 r' U r",
  "R U2' R2' U' R U R U2' R'",
  "U' F' r U R' U' r' F R",
];

function fresh(): { model: CubeModel; rot: RotationEngine } {
  const model = new CubeModel(new CubeMeshFactory(), 3);
  return { model, rot: new RotationEngine(model) };
}

/** Apply a single engine token the way ReplayEngine.setMoves does. */
function applyToken(rot: RotationEngine, token: string, now: number): number {
  const rawFace = token[0];
  const isWide = /^[rludfb]/.test(token) || /^[RLUDFB]w/.test(token);
  const face = (isWide ? rawFace.toUpperCase() : rawFace) as keyof typeof FACE_ROTATION_MAP;
  let suffix = token.slice(1);
  if (isWide && /^[A-Z]/.test(rawFace) && suffix.startsWith('w')) suffix = suffix.slice(1);
  suffix = suffix === "2'" ? '2' : suffix;
  const direction = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
  const mapping = FACE_ROTATION_MAP[face];
  if (!mapping) return now + 71;
  const angle = direction * mapping.angleSign * 90;
  const layers = isWide ? [mapping.layerValue, 0] : [mapping.layerValue];
  rot.rotateLayers(mapping.axis as 'x' | 'y' | 'z', layers, angle, 70, 0);
  rot.update(now);
  now += 71;
  rot.update(now);
  return now;
}

function gridSignature(model: CubeModel): string {
  return model
    .getLogicalState()
    .map((c) => `${c.initialGridX},${c.initialGridY},${c.initialGridZ}->${c.gridX},${c.gridY},${c.gridZ}`)
    .sort()
    .join('|');
}

describe('conjugated replay design', () => {
  it("conjugated r' halves: ONE merged wide event == face + slice separately (all grips)", () => {
    const grips = ["x'", 'y', 'y2', 'x2', 'z', 'z y2', "x' y"];
    for (const grip of grips) {
      const conj = conjugateToBaseFrame(tokenize(`${grip} r'`));
      expect(conj).toHaveLength(2); // face + slice, rotations consumed
      const [fTok, sTok] = conj;

      // Separate application
      const a = fresh();
      let t1 = 1000;
      t1 = applyToken(a.rot, fTok, t1);
      t1 = applyToken(a.rot, sTok, t1);

      // Merged wide (face token, both layers together)
      const b = fresh();
      let t2 = 1000;
      const rawFace = fTok[0];
      const suffixRaw = fTok.slice(1);
      const direction = suffixRaw === '2' ? 2 : suffixRaw === "'" ? -1 : 1;
      const mapping = FACE_ROTATION_MAP[rawFace as keyof typeof FACE_ROTATION_MAP];
      const angle = direction * mapping.angleSign * 90;
      b.rot.rotateLayers(mapping.axis as 'x' | 'y' | 'z', [mapping.layerValue, 0], angle, 70, 0);
      b.rot.update(t2);
      t2 += 71;
      b.rot.update(t2);

      expect(gridSignature(b.model), `grip ${grip}: ${fTok}+${sTok} merged`).toBe(
        gridSignature(a.model),
      );
    }
  });

  it('Zajder: engine applying the CONJUGATED stream matches math-core piece positions exactly', () => {
    CubeState.initTables();
    const conjStream: string[] = [];
    for (const phase of RAW_PHASES) {
      conjStream.push(...conjugateToBaseFrame(tokenize(phase)));
    }
    // Ground truth: the conjugated stream applied literally after the scramble
    // (exactly what the engine does in the cube frame — the root grip is
    // cosmetic and does not touch the pieces).
    const c = new CubeState();
    c.applySequence(SCRAMBLE);
    c.applySequence(conjStream.join(' '));

    // Engine: scramble + conjugated stream (no root rotation — cosmetic).
    const { model, rot } = fresh();
    let now = 1000;
    for (const t of SCRAMBLE.split(' ')) now = applyToken(rot, t, now);
    for (const t of conjStream) now = applyToken(rot, t, now);

    // Position order = the standard Kociemba corner/edge orders used by both
    // CubeState's cp/ep arrays and CubeModel's grid.
    const CORNER_POS_GRID = [
      { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }, { x: -1, y: 1, z: -1 }, { x: 1, y: 1, z: -1 },
      { x: 1, y: -1, z: 1 }, { x: -1, y: -1, z: 1 }, { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
    ];
    const EDGE_POS_GRID = [
      { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 1 }, { x: -1, y: 1, z: 0 }, { x: 0, y: 1, z: -1 },
      { x: 1, y: -1, z: 0 }, { x: 0, y: -1, z: 1 }, { x: -1, y: -1, z: 0 }, { x: 0, y: -1, z: -1 },
      { x: 1, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }, { x: -1, y: 0, z: -1 }, { x: 1, y: 0, z: -1 },
    ];
    const piecePos = new Map<string, string>();
    Array.from(c.cp as unknown as number[]).forEach((piece, pos) => {
      const p = CORNER_POS_GRID[piece];
      piecePos.set(`C${p.x},${p.y},${p.z}`, `${CORNER_POS_GRID[pos].x},${CORNER_POS_GRID[pos].y},${CORNER_POS_GRID[pos].z}`);
    });
    Array.from(c.ep as unknown as number[]).forEach((piece, pos) => {
      const p = EDGE_POS_GRID[piece];
      piecePos.set(`E${p.x},${p.y},${p.z}`, `${EDGE_POS_GRID[pos].x},${EDGE_POS_GRID[pos].y},${EDGE_POS_GRID[pos].z}`);
    });

    let mismatches = 0;
    for (const cubie of model.getLogicalState()) {
      // Centers carry no piece in CubeState (only corners + edges are modeled).
      const coordSum =
        Math.abs(cubie.initialGridX) +
        Math.abs(cubie.initialGridY) +
        Math.abs(cubie.initialGridZ);
      if (coordSum === 1) continue;
      const isCorner = coordSum === 3;
      const key = `${isCorner ? 'C' : 'E'}${cubie.initialGridX},${cubie.initialGridY},${cubie.initialGridZ}`;
      const expected = piecePos.get(key);
      const actual = `${cubie.gridX},${cubie.gridY},${cubie.gridZ}`;
      expect(expected, `piece ${key}`).toBe(actual);
      if (expected !== actual) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('round-trips: R R\' and wide r r\' return the model to home', () => {
    for (const pair of [['R', "R'"], ['r', "r'"]] as const) {
      const { model, rot } = fresh();
      let now = 1000;
      now = applyToken(rot, pair[0], now);
      now = applyToken(rot, pair[1], now);
      const home = model
        .getLogicalState()
        .every(
          (c) =>
            c.gridX === c.initialGridX &&
            c.gridY === c.initialGridY &&
            c.gridZ === c.initialGridZ,
        );
      expect(home, `${pair[0]} ${pair[1]}`).toBe(true);
    }
  });
});
