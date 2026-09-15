/**
 * Pyraminx P1b — the 3D model's acceptance suite (spec §7 of
 * docs/02-architecture/Pyraminx_3D_Model.md).
 *
 * The heart of the suite is FIDELITY: every 3D turn (driven through the real
 * RotationDriver3D hooks) must produce the exact same packed PyraminxState as
 * the clean-room WCA scrambler in @cubalyze/solver-engine — proving the 3D
 * rotation is physically faithful, not just visually plausible.
 */
import { describe, expect, it } from 'vitest';
import { Group, Mesh, Vector3, BufferGeometry, BufferAttribute } from 'three';
import {
  applyPyraminxMove,
  applyPyraminxSequence,
  applyPyraminxTip,
  generatePyraminxScramble,
  solvedPyraminx,
} from '@cubalyze/solver-engine/pyraminx';
import { RotationDriver3D } from '../../animation/RotationDriver3D';
import {
  PYRAMINX_AXES,
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_FACE_CENTERS,
  PYRAMINX_FACE_NORMALS,
  PYRAMINX_TURNS,
  PYRAMINX_VERTEX_EDGES,
  PYRAMINX_VERTEX_INDEX,
  PYRAMINX_VERTEX_POSITIONS,
  PYRAMINX_VERTICES_ORDER,
  pyraminxCornerSlotPosition,
  pyraminxEdgeSlotPosition,
  pyraminxTipSlotPosition,
  resolvePyraminxMoveToken,
  type PyraminxVertex,
} from '../PyraminxGeometry';
import { PyraminxMeshFactory } from '../PyraminxMeshFactory';
import { PyraminxModel } from '../PyraminxModel';
import {
  createPyraminxRotationHooks,
  type PyraminxSliceRef,
} from '../PyraminxEngine';

function buildModel(): { factory: PyraminxMeshFactory; model: PyraminxModel } {
  const factory = new PyraminxMeshFactory();
  const model = new PyraminxModel(factory);
  return { factory, model };
}

function makeDriver(model: PyraminxModel): RotationDriver3D<PyraminxSliceRef> {
  return new RotationDriver3D<PyraminxSliceRef>(model.root, createPyraminxRotationHooks(model));
}

function sliceRef(vertex: PyraminxVertex, scope: 'layer' | 'tip'): PyraminxSliceRef {
  return { id: { vertex, scope }, axis: PYRAMINX_AXES[vertex] };
}

async function applyTurn(
  model: PyraminxModel,
  driver: RotationDriver3D<PyraminxSliceRef>,
  vertex: PyraminxVertex,
  scope: 'layer' | 'tip',
  angleInDegrees: number,
): Promise<void> {
  const done = driver.rotate(sliceRef(vertex, scope), angleInDegrees, 0);
  driver.update(10_000);
  await done;
}

function stickerMeshes(piece: Group): Mesh[] {
  return piece.children.filter(
    (c) => (c as Mesh).userData?.pyraminxSticker === true,
  ) as Mesh[];
}

/** The big face a sticker currently lies on (from its world normal). */
function stickerWorldFace(sticker: Mesh): PyraminxVertex | null {
  const geom = sticker.geometry as BufferGeometry;
  const nAttr = geom.getAttribute('normal') as BufferAttribute;
  const n = new Vector3(nAttr.getX(0), nAttr.getY(0), nAttr.getZ(0));
  n.applyQuaternion(sticker.parent!.quaternion).normalize();
  for (const face of PYRAMINX_VERTICES_ORDER) {
    if (Math.abs(n.dot(PYRAMINX_FACE_NORMALS[face])) > 0.999) return face;
  }
  return null;
}

/**
 * Deterministic 32-bit LCG so scrambles are reproducible (same constants as
 * the solver's own test suite). The Rng contract is `pick(n) → [0, n)` — a
 * uniform [0,1) value WITHOUT the `* n` makes the solver sample only state 0
 * and its 4b3 filter loops forever.
 */
function makeRng(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * n;
  };
}

describe('Pyraminx geometry', () => {
  it('vertices are unit length and form a regular tetrahedron', () => {
    const vs = PYRAMINX_VERTICES_ORDER.map((v) => PYRAMINX_VERTEX_POSITIONS[v]);
    for (const v of vs) expect(v.length()).toBeCloseTo(1, 10);
    const distances: number[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) distances.push(vs[i].distanceTo(vs[j]));
    }
    expect(distances).toHaveLength(6);
    for (const d of distances) expect(d).toBeCloseTo(distances[0], 10);
    expect(distances[0]).toBeCloseTo(2 * Math.sqrt(2 / 3), 10);
  });

  it('rotation axes are unit and point from the center to each vertex', () => {
    for (const v of PYRAMINX_VERTICES_ORDER) {
      expect(PYRAMINX_AXES[v].length()).toBeCloseTo(1, 10);
      expect(PYRAMINX_AXES[v].dot(PYRAMINX_VERTEX_POSITIONS[v])).toBeCloseTo(1, 10);
    }
  });

  it('face centers sit at the inradius (1/3) from the center', () => {
    for (const f of PYRAMINX_VERTICES_ORDER) {
      expect(PYRAMINX_FACE_CENTERS[f].length()).toBeCloseTo(1 / 3, 10);
    }
  });

  it('slot positions are finite and inside the circumsphere', () => {
    for (let slot = 0; slot < 6; slot++) {
      const p = pyraminxEdgeSlotPosition(slot);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(p.length()).toBeLessThan(1);
    }
    for (const v of PYRAMINX_VERTICES_ORDER) {
      expect(pyraminxCornerSlotPosition(v).length()).toBeLessThan(1);
      expect(pyraminxTipSlotPosition(v).length()).toBeLessThan(1);
    }
  });

  it('every vertex turn permutes exactly its 3 incident edges', () => {
    for (const turn of PYRAMINX_TURNS) {
      expect([...turn.cycle].sort()).toEqual([...PYRAMINX_VERTEX_EDGES[turn.vertex]].sort());
    }
  });
});

describe('Pyraminx piece anatomy', () => {
  it('14 pieces: 6 edges (2 stickers), 4 corners (3), 4 tips (3) — 36 stickers total', () => {
    const { model } = buildModel();
    expect(model.edges).toHaveLength(6);
    expect(model.corners).toHaveLength(4);
    expect(model.tips).toHaveLength(4);
    expect(model.pieces).toHaveLength(14);

    for (const e of model.edges) expect(stickerMeshes(e.mesh)).toHaveLength(2);
    for (const c of model.corners) expect(stickerMeshes(c.mesh)).toHaveLength(3);
    for (const t of model.tips) expect(stickerMeshes(t.mesh)).toHaveLength(3);

    const total = model.pieces.reduce((n, p) => n + stickerMeshes(p.mesh).length, 0);
    expect(total).toBe(36);
  });

  it('solved state: every face shows exactly 9 stickers of its own color', () => {
    const { model } = buildModel();
    const perFace: Record<string, string[]> = { U: [], L: [], R: [], B: [] };
    for (const piece of model.pieces) {
      for (const sticker of stickerMeshes(piece.mesh)) {
        const face = stickerWorldFace(sticker);
        expect(face).not.toBeNull();
        perFace[face!].push(sticker.userData.face as string);
      }
    }
    for (const face of PYRAMINX_VERTICES_ORDER) {
      expect(perFace[face]).toHaveLength(9);
      expect(perFace[face].every((c) => c === face)).toBe(true);
    }
  });
});

describe('Pyraminx move fidelity (3D turns == WCA scrambler)', () => {
  it('mirror path: applyLayerTurn + applyTipTurn match the solver for all 8 moves', () => {
    const { model } = buildModel();
    for (let move = 0; move < 8; move++) {
      model.reset();
      const vertex = PYRAMINX_VERTICES_ORDER[move >> 1];
      const steps = ((move & 1) + 1) as 1 | 2;
      model.applyLayerTurn(vertex, steps);
      model.applyTipTurn(vertex, steps);
      const expected = applyPyraminxTip(applyPyraminxMove(solvedPyraminx(), move), move);
      expect(model.getState()).toEqual(expected);
    }
  });

  it('mirror path: tip-only turns match applyPyraminxTip for all 8 tips', () => {
    const { model } = buildModel();
    for (let tipMove = 0; tipMove < 8; tipMove++) {
      model.reset();
      model.applyTipTurn(PYRAMINX_VERTICES_ORDER[tipMove >> 1], ((tipMove & 1) + 1) as 1 | 2);
      expect(model.getState()).toEqual(applyPyraminxTip(solvedPyraminx(), tipMove));
    }
  });

  it('driver path: real ±120° turns through the pivot machinery match the solver', async () => {
    const { model } = buildModel();
    const driver = makeDriver(model);

    // The plain WCA token is the CLOCKWISE turn = −120° right-hand around the
    // outward axis (one logical step); the prime is the +120° counter-clockwise
    // turn (two steps). The driver angles below are the plain/prime pairs.
    for (let move = 0; move < 8; move++) {
      model.reset();
      const vertex = PYRAMINX_VERTICES_ORDER[move >> 1];
      const angle = move % 2 === 0 ? -120 : 120;
      await applyTurn(model, driver, vertex, 'layer', angle);
      const expected = applyPyraminxTip(applyPyraminxMove(solvedPyraminx(), move), move);
      expect(model.getState()).toEqual(expected);
    }

    for (let tipMove = 0; tipMove < 8; tipMove++) {
      model.reset();
      const vertex = PYRAMINX_VERTICES_ORDER[tipMove >> 1];
      const angle = tipMove % 2 === 0 ? -120 : 120;
      await applyTurn(model, driver, vertex, 'tip', angle);
      expect(model.getState()).toEqual(applyPyraminxTip(solvedPyraminx(), tipMove));
    }
  });

  it('a full random-state WCA scramble via the driver equals applyPyraminxSequence', async () => {
    const { model } = buildModel();
    const driver = makeDriver(model);
    const scramble = generatePyraminxScramble(makeRng(123456789));
    expect(scramble.length).toBeGreaterThan(0);

    for (const token of scramble.split(/\s+/)) {
      const r = resolvePyraminxMoveToken(token)!;
      await applyTurn(model, driver, r.vertex, r.scope, r.angleInDegrees);
    }
    // The MAIN puzzle (edges + corners) must match the WCA scrambler exactly.
    // The tips differ BY DESIGN: layer turns physically rotate the tip on a
    // real puzzle, while the scrambler's state model treats tips as only
    // moved by the appended tip turns (they are trivial, so this never
    // affects scramble validity — and a physical simulator must show the
    // real tip positions).
    const solverState = applyPyraminxSequence(solvedPyraminx(), scramble)!;
    const main = (s: typeof solverState) => ({
      edgePerm: s.edgePerm,
      edgeOrient: s.edgeOrient,
      cornerOrient: s.cornerOrient,
    });
    expect(main(model.getState())).toEqual(main(solverState));
    expect(model.isSolved()).toBe(false);
    expect(model.getState()).not.toEqual(solvedPyraminx());

    // The inverse sequence restores the solved state.
    const inverse = scramble
      .split(/\s+/)
      .reverse()
      .map((t) => (t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
      .join(' ');
    for (const token of inverse.split(/\s+/)) {
      const r = resolvePyraminxMoveToken(token)!;
      await applyTurn(model, driver, r.vertex, r.scope, r.angleInDegrees);
    }
    expect(model.isSolved()).toBe(true);
    expect(model.getState()).toEqual(solvedPyraminx());
  });

  it('order 3: three turns of the same vertex return to solved (meshes included)', async () => {
    const { model } = buildModel();
    const driver = makeDriver(model);
    for (const vertex of PYRAMINX_VERTICES_ORDER) {
      model.reset();
      for (let i = 0; i < 3; i++) await applyTurn(model, driver, vertex, 'layer', 120);
      expect(model.isSolved()).toBe(true);
      for (const piece of model.pieces) {
        // Positions are snapped to the exact slot positions — home again.
        expect(piece.mesh.position.distanceTo(model.slotPositionOf(piece))).toBeLessThan(1e-9);
        // 3 × 120° = 360° → quaternion back to (near) identity.
        expect(Math.abs(piece.mesh.quaternion.w)).toBeGreaterThan(0.9999);
        expect(Math.abs(piece.mesh.quaternion.x)).toBeLessThan(0.01);
        expect(Math.abs(piece.mesh.quaternion.y)).toBeLessThan(0.01);
        expect(Math.abs(piece.mesh.quaternion.z)).toBeLessThan(0.01);
      }
    }
  });

  it("a prime move equals two single turns of the same vertex", async () => {
    const { model } = buildModel();
    const driver = makeDriver(model);

    // Prime (+120° counter-clockwise, 2 steps) == two single turns (−120°).
    model.reset();
    await applyTurn(model, driver, 'U', 'layer', 120);
    await applyTurn(model, driver, 'U', 'tip', 120);
    const prime = model.getState();

    model.reset();
    await applyTurn(model, driver, 'U', 'layer', -120);
    await applyTurn(model, driver, 'U', 'layer', -120);
    await applyTurn(model, driver, 'U', 'tip', -120);
    await applyTurn(model, driver, 'U', 'tip', -120);
    expect(model.getState()).toEqual(prime);
  });
});

describe('Pyraminx visual fidelity (physical stickers == geometric rotation)', () => {
  /**
   * Independent oracle: simulate the puzzle by rotating STICKER LABELS with
   * pure geometry (the same axis/angle the driver uses) — NO solver tables,
   * NO model mirror. If the driver's physical rotation is correct, every
   * sticker's actual face after a scramble must equal the label simulation.
   * This is what proves the visual state is the scramble's true state (the
   * logical side is separately verified against applyPyraminxMove).
   */
  function makeLabelSim() {
    const edges = new Map<number, { slot: number; faceOf: Record<string, string> }>();
    for (let e = 0; e < 6; e++) {
      const def = PYRAMINX_EDGE_SLOTS[e];
      edges.set(e, { slot: e, faceOf: { [def.faces[0]]: def.faces[0], [def.faces[1]]: def.faces[1] } });
    }
    const corners: Record<number, Record<string, string>> = {};
    const tips: Record<number, Record<string, string>> = {};
    for (let v = 0; v < 4; v++) {
      const faces = PYRAMINX_VERTICES_ORDER.filter((f) => f !== PYRAMINX_VERTICES_ORDER[v]);
      corners[v] = Object.fromEntries(faces.map((f) => [f, f]));
      tips[v] = Object.fromEntries(faces.map((f) => [f, f]));
    }
    return { edges, corners, tips };
  }

  function rotateLabel(face: string, axis: Vector3, angleInDegrees: number): string {
    const n = PYRAMINX_FACE_NORMALS[face as PyraminxVertex]
      .clone()
      .applyAxisAngle(axis, (angleInDegrees * Math.PI) / 180);
    let best = 'U';
    let bestDot = -Infinity;
    for (const f of PYRAMINX_VERTICES_ORDER) {
      const d = n.dot(PYRAMINX_FACE_NORMALS[f]);
      if (d > bestDot) {
        bestDot = d;
        best = f;
      }
    }
    return best;
  }

  function rotateSlot(slot: number, axis: Vector3, angleInDegrees: number): number {
    const p = pyraminxEdgeSlotPosition(slot)
      .clone()
      .applyAxisAngle(axis, (angleInDegrees * Math.PI) / 180);
    let best = 0;
    let bestDist = Infinity;
    for (let s = 0; s < 6; s++) {
      const d = p.distanceTo(pyraminxEdgeSlotPosition(s));
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  function applyMoveToSim(
    sim: ReturnType<typeof makeLabelSim>,
    vertex: PyraminxVertex,
    scope: 'layer' | 'tip',
    angleInDegrees: number,
  ): void {
    const axis = PYRAMINX_AXES[vertex];
    if (scope === 'layer') {
      // Only the 3 edges INCIDENT to the vertex move — the other 3 stay put
      // (position AND sticker faces). The corner at the vertex rotates in
      // place (corners are position-fixed), and the tip rides along.
      const incident = new Set(PYRAMINX_VERTEX_EDGES[vertex]);
      for (const edge of sim.edges.values()) {
        if (!incident.has(edge.slot)) continue;
        edge.slot = rotateSlot(edge.slot, axis, angleInDegrees);
        for (const key of Object.keys(edge.faceOf)) edge.faceOf[key] = rotateLabel(edge.faceOf[key], axis, angleInDegrees);
      }
      const corner = sim.corners[PYRAMINX_VERTEX_INDEX[vertex]];
      for (const key of Object.keys(corner)) corner[key] = rotateLabel(corner[key], axis, angleInDegrees);
    }
    // A tip turn rotates ONLY the tip (edges/corners stay put).
    const tip = sim.tips[PYRAMINX_VERTEX_INDEX[vertex]];
    for (const key of Object.keys(tip)) tip[key] = rotateLabel(tip[key], axis, angleInDegrees);
  }

  async function scrambleWithSim(): Promise<{
    model: PyraminxModel;
    sim: ReturnType<typeof makeLabelSim>;
  }> {
    const { model } = buildModel();
    const driver = makeDriver(model);
    const sim = makeLabelSim();
    const scramble = generatePyraminxScramble(makeRng(42));
    for (const token of scramble.split(/\s+/)) {
      const r = resolvePyraminxMoveToken(token)!;
      applyMoveToSim(sim, r.vertex, r.scope, r.angleInDegrees);
      await applyTurn(model, driver, r.vertex, r.scope, r.angleInDegrees);
    }
    return { model, sim };
  }

  it('every sticker lies flat on exactly one big face after a scramble', async () => {
    const { model } = await scrambleWithSim();
    for (const piece of model.pieces) {
      for (const sticker of stickerMeshes(piece.mesh)) {
        expect(stickerWorldFace(sticker)).not.toBeNull();
      }
    }
  });

  it('edge slots and sticker faces equal the geometric label simulation', async () => {
    const { model, sim } = await scrambleWithSim();
    for (const edge of model.edges) {
      const expected = sim.edges.get(edge.home)!;
      expect(edge.current).toBe(expected.slot);
      for (const sticker of stickerMeshes(edge.mesh)) {
        const homeFace = sticker.userData.face as string;
        expect(stickerWorldFace(sticker)).toBe(expected.faceOf[homeFace]);
      }
    }
  });

  it('corner and tip stickers equal the geometric label simulation', async () => {
    const { model, sim } = await scrambleWithSim();
    for (const corner of model.corners) {
      const expected = sim.corners[corner.home];
      for (const sticker of stickerMeshes(corner.mesh)) {
        expect(stickerWorldFace(sticker)).toBe(expected[sticker.userData.face as string]);
      }
    }
    for (const tip of model.tips) {
      const expected = sim.tips[tip.home];
      for (const sticker of stickerMeshes(tip.mesh)) {
        expect(stickerWorldFace(sticker)).toBe(expected[sticker.userData.face as string]);
      }
    }
  });
});

describe('Pyraminx registry', () => {
  it('the pyraminx family has a registered builder when the package is imported', async () => {
    // Importing the package index registers every puzzle family (nxn + pyraminx).
    // The full engine index (three.js + the whole package) takes ~2s even
    // alone — under full parallel load it can exceed the 5s default, so it
    // gets an explicit budget (same fix as the web 1000-scramble test).
    const { getPuzzle3DFactory } = await import('../../index');
    expect(getPuzzle3DFactory('pyraminx')?.kind).toBe('pyraminx');
  }, 30_000);
});
