/**
 * El solve 2510 a través del PhaseSplitter REAL, con la conjugación CORRECTA de frame:
 *
 *   D) SMART CUBE — cada movimiento del solver conjugado por la rotación de frame
 *      acumulada (R·M·R⁻¹). CERO rotaciones en el stream. EQUIVALENTE EXACTO a lo
 *      que registra el smart cube (el cubo no reporta rotaciones; las del usuario
 *      son invisibles al stream de movimientos).
 *
 * Preguntas que responde:
 *   1. ¿La reconstrucción es fiel?  → si final isSolved = true, SÍ.
 *   2. ¿El PhaseSplitter actual detecta fases en un solve real de cross blanca?
 *      → si phases = 0, hay un bug de COLOR (los masks piden la cross amarilla).
 */
import { TimelineBuilder } from "../../packages/analysis-engine/src/timeline/TimelineBuilder";
import { PhaseSplitter } from "../../packages/analysis-engine/src/phases/PhaseSplitter";
import { CFOPDefinition, CubeState } from "../../packages/math-core/src/index";

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  s = s.replace(new RegExp(`([${FACE}])([0-9]+)'`, "g"), (_m, f: string, nS: string) => {
    const n = Number(nS) % 4;
    if (n === 0) return "";
    if (n === 1) return `${f}'`;
    if (n === 2) return `${f}2`;
    return f;
  });
  return s.trim().split(/\s+/).filter(Boolean);
}

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const SOLVE = [
  "z y",
  "D2 L U R' U'",
  "D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U2 U L U' L'",
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
].flatMap(tokenize);
const IS_ROT = (m: string) => /^[xyz]/.test(m);

const invToken = (t: string) =>
  t.endsWith("'") ? t[0] : t.endsWith("2") ? t : t + "'";

function run(label: string, events: { face: string; direction: number }[], states: CubeState[]) {
  const ev = events.map((m, i) => ({ ...m, cubeTimestamp: i, hostTimestamp: i }));
  const timeline = TimelineBuilder.build(ev, "CFOP");
  timeline.entries = events.map((m, i) => ({
    index: i,
    move: ev[i],
    displayMove: { face: ev[i].face, direction: ev[i].direction, cubeTimestamp: i, hostTimestamp: i },
    state: {
      cp: Array.from(states[i].cp),
      co: Array.from(states[i].co),
      ep: Array.from(states[i].ep),
      eo: Array.from(states[i].eo),
    },
    hostTimestamp: i,
  }));
  timeline.initialStateSource = "scramble";
  timeline.startTimestamp = 0;
  timeline.endTimestamp = events.length - 1;
  PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

  const finalState = states[states.length - 1];
  const isSolved = finalState.isSolved();
  console.log(`\n═══ ${label} ═══`);
  console.log(`movimientos: ${events.length} | final isSolved: ${isSolved}${isSolved ? "  ← reconstrucción FIEL" : "  ← reconstrucción NO fiel o frame mal tratado"}`);
  console.log(`crossFace: ${timeline.detectionReport?.crossFace ?? "—"} | confianza: ${timeline.detectionReport?.confidence}`);
  console.log(`phases: ${timeline.phases.length}`);
  for (const p of timeline.phases) {
    console.log(`  • ${p.phaseName}: mov ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount}m)${p.skipped ? " [skipped]" : ""}`);
  }
}

// ── D) SMART CUBE (conjugación por frame acumulado) ──────────────────────
const state = new CubeState();
state.applySequence(SCRAMBLE);
const frameTokens: string[] = [];
const events: { face: string; direction: number }[] = [];
const frameInv = () => [...frameTokens].reverse().map(invToken).join(" ");
const frameFwd = () => frameTokens.join(" ");

const statesD: CubeState[] = [];
for (const m of SOLVE) {
  if (IS_ROT(m)) {
    frameTokens.push(m); // la rotación es invisible al stream (solo frame)
    continue;
  }
  // estado = R·M·R⁻¹·estado
  state.applySequence(frameInv());
  state.applySequence(m);
  state.applySequence(frameFwd());
  events.push({
    face: m[0],
    direction: m.endsWith("'") ? -1 : m.endsWith("2") ? 2 : 1,
  });
  statesD.push(new CubeState(state.cp, state.co, state.ep, state.eo));
}
run("D) SMART CUBE — conjugado por frame (sin rotaciones)", events, statesD);

// ── D2) Variante: F2L 3 según quest ("U' L U' L'") ───────────────────────
const state2 = new CubeState();
state2.applySequence(SCRAMBLE);
const SOLVE2 = [
  "z y",
  "D2 L U R' U'",
  "D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U' L U' L'", // quest
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
].flatMap(tokenize);
const frame2: string[] = [];
const ev2: { face: string; direction: number }[] = [];
const st2: CubeState[] = [];
const fInv2 = () => [...frame2].reverse().map(invToken).join(" ");
const fFwd2 = () => frame2.join(" ");
for (const m of SOLVE2) {
  if (IS_ROT(m)) { frame2.push(m); continue; }
  state2.applySequence(fInv2());
  state2.applySequence(m);
  state2.applySequence(fFwd2());
  ev2.push({ face: m[0], direction: m.endsWith("'") ? -1 : m.endsWith("2") ? 2 : 1 });
  st2.push(new CubeState(state2.cp, state2.co, state2.ep, state2.eo));
}
run("D2) SMART CUBE con F2L3=quest (U' L U' L')", ev2, st2);

// ── A) RAW (literal: rotaciones como movimientos) ─────────────────────────
const rawState = new CubeState();
rawState.applySequence(SCRAMBLE);
const rawEvents: { face: string; direction: number }[] = [];
const rawStates: CubeState[] = [];
for (const m of SOLVE) {
  rawState.applySequence(m);
  rawEvents.push({
    face: m[0],
    direction: m.endsWith("'") ? -1 : m.endsWith("2") ? 2 : 1,
  });
  rawStates.push(new CubeState(rawState.cp, rawState.co, rawState.ep, rawState.eo));
}
run("A) RAW — literal (rotaciones como movimientos)", rawEvents, rawStates);
