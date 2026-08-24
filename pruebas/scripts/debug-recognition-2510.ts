/**
 * Diagnóstico del nuevo ReconstructionAnalyzer sobre el solve 2510.
 * Uso: pnpm dlx tsx pruebas/scripts/debug-recognition-2510.ts
 */
import { analyzeReconstruction } from "../../packages/algorithm-db/src/recognition/reconstructionAnalyzer";
import { getRecognitionIndex } from "../../packages/algorithm-db/src/recognition/caseIndex";
import { f2lSignature } from "../../packages/algorithm-db/src/recognition/signatures";
import { findCrossOnDFrames, findRotationOfSolved } from "../../packages/algorithm-db/src/recognition/rotationGroup";
import { detectConventionFromColors } from "../../packages/algorithm-db/src/recognition/conventions";
import { CubeState } from "../../packages/math-core/src/index";

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

const USER = [
  { name: "Cross", moves: "D2 L U R' U'" },
  { name: "F2L 1 (BL · Pj)", moves: "D' L' U L U' L' U L D" },
  { name: "F2L 2 (FR · Jm)", moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: "F2L 3 (FL · Jb)", moves: "U' L U' L'" },
  { name: "F2L 4 (BR · Ci)", moves: "y' R' U2 R U R' U' R" },
  { name: "OLL", moves: "R' U' R' F R F' U R" },
  { name: "PLL", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

const CUBEROOT = [
  { name: "Inspection", moves: "z y" },
  { name: "Cross (W)", moves: "D2 L U R' U'" },
  { name: "F2L 1 (BL · Pj)", moves: "x' D' L' U L U' L' U L D" },
  { name: "F2L 2 (FR · Jm)", moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: "F2L 3 (BR · Jb)", moves: "U2 U L U' L'" },
  { name: "F2L 4 (BR · Ci)", moves: "y' R' U2 R U R' U' R" },
  { name: "OLL", moves: "R' U' R' F R F' U R" },
  { name: "PLL", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

// ── Replay helpers (raw token replay, same as the analyzer) ────────────────
const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(m: string): string[] {
  let s = m.replace(PRIME, "'").replace(/[↑·()]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

function replay(scramble: string, phases: { name: string; moves: string }[]) {
  const state = new CubeState();
  state.applySequence(scramble);
  const states: CubeState[] = [];
  const borders: { name: string; start: number }[] = [];
  let idx = 0;
  for (const p of phases) {
    const toks = tokenize(p.moves);
    borders.push({ name: p.name, start: idx });
    idx += toks.length;
    for (const t of toks) state.applySequence(t);
    states.push(state.clone());
  }
  return { final: state, borders, states };
}

function show(label: string, phases: { name: string; moves: string }[]) {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
  const { final, borders, states } = replay(SCRAMBLE, phases);
  console.log(`final isSolved: ${final.isSolved()} | rotOfSolved: ${findRotationOfSolved(final) ?? "NONE"}`);
  const crossIdx = borders.findIndex((b) => /cross/i.test(b.name));
  if (crossIdx < 0) { console.log("NO cross phase"); return; }
  const crossEnd = states[crossIdx];
  console.log(`cross end state (after phase ${phases[crossIdx].name}):`);
  console.log(`  convention: ${JSON.stringify(detectConventionFromColors(crossEnd))}`);
  for (const [label2, conv] of [
    ["catalog 4-7", [4, 5, 6, 7]],
    ["solver  0-3", [0, 1, 2, 3]],
  ] as const) {
    console.log(`  frames cross-on-D (${label2}): ${findCrossOnDFrames(crossEnd, conv).length}`);
  }
  // F2L 1 pre-state
  const f2l1 = borders.findIndex((b) => /f2l/i.test(b.name));
  if (f2l1 < 0) return;
  const pre = f2l1 === 0 ? (() => { const s = new CubeState(); s.applySequence(SCRAMBLE); return s; })() : states[f2l1 - 1];
  console.log(`F2L 1 pre-state (before ${phases[f2l1].name}):`);
  for (const [label2, conv] of [
    ["catalog 4-7", [4, 5, 6, 7]],
    ["solver  0-3", [0, 1, 2, 3]],
  ] as const) {
    const fr = findCrossOnDFrames(pre, conv);
    const sig = f2lSignature(pre, conv);
    console.log(`  ${label2}: frames=${fr.length} sig=${sig ? sig.slice(0, 80) : "null"}`);
  }
  const idx = getRecognitionIndex();
  console.log(`index: f2l cases=${idx.f2lCases} unindexed=${idx.f2lUnindexed.length} collisions=${idx.f2lCollisions}`);
  if (idx.f2lUnindexed.length) console.log(`  unindexed: ${idx.f2lUnindexed.join(", ")}`);
  const res = analyzeReconstruction({ scramble: SCRAMBLE, phases });
  console.log(`\nanalyzer: finalSolved=${res.finalSolved} rot=${res.finalRotation ?? "NONE"}`);
  console.log(`crossVerified=${res.crossVerified}`);
  console.log(`pairs: ${res.pairs.map((p) => `${p.caseMatch.caseNumber ?? "?"}@${p.slot ?? "?"}`).join(" | ")}`);
  console.log(`oll=${res.oll?.caseMatch.caseNumber ?? "?"} pll=${res.pll?.caseMatch.caseNumber ?? "?"}`);
  console.log("debug:");
  for (const line of res.debug) console.log(`  ${line}`);
}

show("USER (Quest display — sin inspección)", USER);
show("CUBEROOT (con inspección z y)", CUBEROOT);
