import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplayEngine, type ReplayCallbacks } from '../replay/ReplayEngine';
import { CubeModel } from '../core/CubeModel';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { RotationEngine } from '../animation/RotationEngine';
import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import {
  conjugatePhaseStream,
  CubeState,
  OrientationTable,
  tokenize,
} from '@cubalyze/math-core';
import { Quaternion } from 'three';
import type { CubeMoveEvent, OrientationTimeline } from '@cubalyze/types';

/**
 * REPRODUCTION for "replay does not visually end solved after rotation
 * animations". Uses the EXACT record the user reported (reconz-11413,
 * Yiheng Wang 2.40, Stewy) — scramble + phases from the baked dataset.
 *
 * The test co-simulates the FULL stack:
 *  1. reconData normalization (conjugated moves + uncompressed grip timeline)
 *  2. ReplayEngine tick on the main thread (real rAF + clock semantics)
 *  3. Worker-side renderer (REAL CubeModel + RotationEngine + root SLERP)
 *
 * and asserts the FINAL VISUAL state: every cubie home (position + sticker
 * quaternion) and the root at the final solver grip.
 */

// ─── The real record ─────────────────────────────────────────────────────────

const SCRAMBLE = "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'";
const PHASES = [
  'F R U\' D\' L U R U\' D',                       // xcross (9)
  "y' L' U L",                                      // 2nd pair (rotation y')
  "y L' U L U' D' L' U L U' D",                     // 3rd pair (rotation y)
  "U' L' U' L U L' U L",                            // 4th pair/WVLS
  'U',                                              // AUF
];

// ─── reconData normalization (replicated 1:1) ────────────────────────────────

function displayRotationEntry(dt: string) {
  const norm =
    dt.length >= 3 && dt.endsWith("'") && dt[dt.length - 2] === '2'
      ? dt.slice(0, -1)
      : dt;
  return OrientationTable.rotationEntryFor(norm);
}

function normalize(): {
  replayTokens: string[];
  timeline: OrientationTimeline;
} {
  const { perPhase } = conjugatePhaseStream(PHASES.map((p) => tokenize(p)));

  const replayTokens: string[] = [];
  const rawOrientTimeline: [number, number][] = [];
  let grip = OrientationTable.IDENTITY;
  let faceIdx = 0;

  PHASES.forEach((phase, phaseIdx) => {
    const displayTokens = tokenize(phase, { expandWide: false });
    for (const dt of displayTokens) {
      const rot = displayRotationEntry(dt);
      if (rot) {
        grip = OrientationTable.compose(rot, grip);
        rawOrientTimeline.push([faceIdx, grip.id]);
        continue;
      }
      faceIdx++;
    }
    const conj = perPhase[phaseIdx] ?? [];
    let ci = 0;
    for (const dt of displayTokens) {
      if (displayRotationEntry(dt)) continue;
      replayTokens.push(conj[ci] ?? dt);
      ci++;
    }
  });

  return { replayTokens, timeline: rawOrientTimeline };
}

// ─── Token → engine event (notationToReplayMoves, non-wide path) ────────────

function toEvent(token: string): CubeMoveEvent {
  const face = token[0] as CubeMoveEvent['face'];
  const suffix = token.slice(1);
  const direction = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
  return { face, direction, cubeTimestamp: 0, hostTimestamp: 0 };
}

// ─── Co-simulation ───────────────────────────────────────────────────────────

interface Sim {
  model: CubeModel;
  rot: RotationEngine;
  mainNow: number;
  workerNow: number;
  appliedMoves: string[];
  appliedOrientations: { oi: number; dur: number }[];
  engine: ReplayEngine;
  /** Root SLERP state (mirrors Cube3DEngine.orientationAnim). */
  orientAnim: {
    start: Quaternion;
    target: Quaternion;
    startTime: number;
    dur: number;
    resolve: () => void;
  } | null;
}

function buildSim(replayTokens: string[], timeline: OrientationTimeline): Sim {
  const model = new CubeModel(new CubeMeshFactory(), 3);
  const rot = new RotationEngine(model);

  const sim: Sim = {
    model,
    rot,
    mainNow: 0,
    workerNow: 0,
    appliedMoves: [],
    appliedOrientations: [],
    engine: null as unknown as ReplayEngine,
    orientAnim: null,
  };

  const callbacks: ReplayCallbacks = {
    resetCube: () => {
      model.resetCube();
      model.root.quaternion.identity();
    },
    rotateLayers: (axis, layers, angle, dur, elapsed) => {
      sim.appliedMoves.push(`${axis}${layers.join('')}:${angle}`);
      // Faithful worker behavior: schedule the pivot task; collision logic
      // snaps overlapping tasks instantly, exactly like the real engine.
      sim.rot.rotateLayers(axis as 'x' | 'y' | 'z', layers as number[], angle, dur ?? 0, elapsed ?? 0);
      // Simulate one worker frame so duration-0 (seek/scramble) snaps.
      if (!dur) sim.rot.update(sim.workerNow);
      return Promise.resolve();
    },
    setOrientation: (oi, dur) =>
      new Promise<void>((resolve) => {
        sim.appliedOrientations.push({ oi, dur: dur ?? 0 });
        const entry = OrientationTable.ENTRIES[oi];
        const duration = dur ?? 0;
        if (!entry || duration <= 0) {
          model.root.quaternion.copy(entry.quaternion as unknown as Quaternion);
          resolve();
          return;
        }
        sim.orientAnim = {
          start: model.root.quaternion.clone(),
          target: new Quaternion().copy(entry.quaternion as unknown as Quaternion),
          startTime: sim.workerNow,
          dur: duration,
          resolve,
        };
      }),
  };

  const engine = new ReplayEngine(
    replayTokens.map(toEvent),
    callbacks,
    replayTokens.length * 500,
    timeline,
  );
  engine.moveAnimationDurationMs = 350;
  engine.moveSpacingMs = 500;
  engine.preRollDurationMs = 600;
  engine.orientationAnimationDurationMs = 280;
  engine.preRollEnabled = true; // reconToSolve sets replayMovesConjugated === true
  sim.engine = engine;
  return sim;
}

/** Run one worker frame: pivot tasks + root SLERP (mirrors Cube3DEngine.loop). */
function workerFrame(sim: Sim): void {
  sim.workerNow += 16.67;
  sim.rot.update(sim.workerNow);
  if (sim.orientAnim) {
    const t = (sim.workerNow - sim.orientAnim.startTime) / sim.orientAnim.dur;
    if (t >= 1) {
      sim.model.root.quaternion.copy(sim.orientAnim.target);
      const resolve = sim.orientAnim.resolve;
      sim.orientAnim = null;
      resolve();
    } else {
      const eased = 1 - Math.pow(1 - t, 3);
      sim.model.root.quaternion.slerpQuaternions(
        sim.orientAnim.start,
        sim.orientAnim.target,
        eased,
      );
    }
  }
}

/** Drive the main-thread tick loop until the replay completes. */
async function playToEnd(sim: Sim): Promise<void> {
  // Drive the engine's virtual clock through the performance stub.
  vi.stubGlobal('performance', { now: () => sim.mainNow });
  // Map-based rAF (same pattern as driveMain in the race tests): each
  // scheduled frame is stored and fired on the next loop iteration.
  const rafMap = new Map<number, FrameRequestCallback>();
  let seq = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafMap.set(++seq, cb);
    return seq;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafMap.delete(id);
  });

  await sim.engine.play();
  let guard = 0;
  while (rafMap.size > 0 && sim.engine.state !== 'complete' && guard++ < 4000) {
    sim.mainNow += 16.67;
    const cbs = [...rafMap.values()];
    rafMap.clear();
    for (const cb of cbs) cb(0);
    // Let the worker process queued tasks + orientation SLERP.
    workerFrame(sim);
    workerFrame(sim);
    await Promise.resolve();
  }
  expect(sim.engine.state).toBe('complete');
}

function isSolvedState(model: CubeModel): {
  solved: boolean;
  offenders: string[];
} {
  const offenders: string[] = [];
  for (const c of model.getLogicalState()) {
    const home =
      c.gridX === c.initialGridX &&
      c.gridY === c.initialGridY &&
      c.gridZ === c.initialGridZ;
    const q = c.mesh.quaternion;
    const oriented =
      Math.abs(q.w) > 0.999 &&
      Math.abs(q.x) < 0.01 &&
      Math.abs(q.y) < 0.01 &&
      Math.abs(q.z) < 0.01;
    // Center pieces (|x|+|y|+|z| === 1) carry a single symmetric sticker —
    // their orientation is VISUALLY INVISIBLE, so only positions matter.
    const isCenter =
      Math.abs(c.initialGridX) +
      Math.abs(c.initialGridY) +
      Math.abs(c.initialGridZ) === 1;
    if (!home || (!oriented && !isCenter)) {
      offenders.push(
        `${c.initialGridX},${c.initialGridY},${c.initialGridZ} -> grid ${c.gridX},${c.gridY},${c.gridZ} q(${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)})${home ? '' : ' OFF-GRID'}${oriented || isCenter ? '' : ' MISORIENTED'}`,
      );
    }
  }
  return { solved: offenders.length === 0, offenders };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reconz-11413 replay (user-reported visual unsolved)', () => {
  it('data: scramble + conjugated stream solves the cube (math-core ground truth)', () => {
    const { replayTokens } = normalize();
    CubeState.initTables();
    const c = new CubeState();
    c.applySequence(SCRAMBLE);
    c.applySequence(replayTokens.join(' '));
    expect(c.isSolved()).toBe(true);
  });

  it('engine: scramble + conjugated moves leave EVERY cubie home and oriented, even with root grip turns (no visual corruption)', () => {
    const { replayTokens, timeline } = normalize();
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const rot = new RotationEngine(model);
    let now = 1000;

    const applyToken = (token: string) => {
      const ev = toEvent(token);
      const mapping = FACE_ROTATION_MAP[ev.face as keyof typeof FACE_ROTATION_MAP];
      const angle = ev.direction * mapping.angleSign * 90;
      rot.rotateLayers(mapping.axis as 'x' | 'y' | 'z', [mapping.layerValue], angle, 70, 0);
      rot.update(now);
      now += 71;
      rot.update(now);
      // Simulate a concurrent root grip SLERP segment like the real replay:
      // every ~3rd move, sweep the root quaternion partway and back.
      const grip = OrientationTable.ENTRIES[timeline[0]?.[1] ?? 0];
      if (grip && now % 3 === 0) {
        const mid = model.root.quaternion.clone().slerp(
          grip.quaternion as unknown as Quaternion,
          0.5,
        );
        model.root.quaternion.copy(mid);
        rot.update(now);
      }
    };

    for (const t of SCRAMBLE.split(' ')) applyToken(t);
    for (const t of replayTokens) applyToken(t);
    rot.update(now + 100);
    // Full worker loop: keep stepping until every pivot task snaps.
    for (let i = 0; i < 2000; i++) {
      now += 16.67;
      rot.update(now);
      if (!rot.isAnimating()) break;
    }

    const { solved, offenders } = isSolvedState(model);
    expect(offenders.slice(0, 5)).toEqual([]);
    expect(solved).toBe(true);
  });

  it('FULL STACK: replay plays all 31 moves, root reaches the final grip, cube visually solved', async () => {
    const { replayTokens, timeline } = normalize();
    expect(replayTokens).toHaveLength(31);
    expect(timeline).toEqual([
      [9, expect.any(Number)],
      [12, 0], // y' then y → back to identity
    ]);

    const sim = buildSim(replayTokens, timeline);

    // Apply the scramble the way ReplaySection does.
    await sim.engine.applyInitialScramble(SCRAMBLE);
    // Only the SOLVE moves count as replay moves (the scramble used the same
    // callback).
    sim.appliedMoves.length = 0;

    await playToEnd(sim);

    // 1. EVERY move was applied by the tick (Move 31/31).
    expect(sim.appliedMoves).toHaveLength(31);
    expect(sim.engine.currentMoveIndex).toBe(30);

    // 2. Both grip rotations were requested, in order.
    expect(sim.appliedOrientations.map((o) => o.oi)).toEqual([
      expect.any(Number), // y' at move 9
      0,                  // back to identity at move 12
    ]);

    // 3. The root ended at the FINAL solver grip (identity for this solve).
    const rootQ = sim.model.root.quaternion;
    expect(Math.abs(rootQ.w)).toBeGreaterThan(0.999);
    expect(Math.abs(rootQ.x)).toBeLessThan(0.01);
    expect(Math.abs(rootQ.y)).toBeLessThan(0.01);
    expect(Math.abs(rootQ.z)).toBeLessThan(0.01);

    // 4. VISUAL STATE: every cubie home AND sticker-oriented (looks solved).
    const { solved, offenders } = isSolvedState(sim.model);
    expect(offenders.slice(0, 5)).toEqual([]);
    expect(solved).toBe(true);
  });

  it('FULL STACK + LAST-MOVE 2-STEP RUN: the complete transition must not cut the final grip chain', async () => {
    // A solve whose LAST move index carries TWO consecutive rotations
    // (e.g. "y2 y'" before the final AUF) — the tick fires the chain and hits
    // pos >= totalMs on the SAME frame; the chain must still apply BOTH steps.
    const { replayTokens } = normalize();
    const lastIdx = replayTokens.length - 1; // 30
    const timeline: OrientationTimeline = [
      [lastIdx, 6],  // y2
      [lastIdx, 7],  // y2 then y' — composed orientation (example ids)
    ];
    const sim = buildSim(replayTokens, timeline);
    await sim.engine.applyInitialScramble(SCRAMBLE);
    sim.appliedMoves.length = 0;

    await playToEnd(sim);

    expect(sim.appliedMoves).toHaveLength(31);
    // BOTH steps of the final run must have been requested.
    expect(sim.appliedOrientations.map((o) => o.oi)).toEqual([6, 7]);
    // Root must end at the FINAL orientation (7), not stuck at 6.
    const entry = OrientationTable.ENTRIES[7];
    const q = sim.model.root.quaternion;
    const e = entry.quaternion as unknown as Quaternion;
    const dot = Math.abs(q.x * e.x + q.y * e.y + q.z * e.z + q.w * e.w);
    expect(dot).toBeGreaterThan(0.999);
  });
});
