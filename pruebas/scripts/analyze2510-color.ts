/**
 * Análisis del solve 2510 (Liam Walton, CubeRoot) con el NUEVO ColorPhaseDetector.
 * Compara las fronteras que detecta nuestro sistema con las fases de CubeRoot.
 *
 * Versión USER (pegada por el usuario) y versión OLD (con inspección z y + x').
 */
import { CubeState, ColorPhaseDetector, FaceletStringConverter } from "../../packages/math-core/src/index";

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

// Fases anotadas por CubeRoot (con sus counts)
const ANNOTATED = [
  { name: "Cross", moves: "D2 L U R' U'", count: 5 },
  { name: "F2L 1 (BL · Pj)", moves: "D' L' U L U' L' U L D", count: 9 },
  { name: "F2L 2 (FR · Jm)", moves: "U2 y' L' U L U' L' U L U2 L' U L", count: 12 },
  { name: "F2L 3 (FL · Jb)", moves: "U' L U' L'", count: 4 },
  { name: "F2L 4 (BR · Ci)", moves: "y' R' U2 R U R' U' R", count: 7 },
  { name: "OLL 46", moves: "R' U' R' F R F' U R", count: 8 },
  { name: "PLL Gd", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'", count: 16 },
];

const SOLVE_OLD = [
  "z y",                                  // inspección
  "D2 L U R' U'",
  "x' D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U2 U L U' L'",
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
];

function fullSig(c: CubeState): string {
  return `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}|${Array.from(c.co).join(",")}|${Array.from(c.eo).join(",")}`;
}
function genRotations(): string[] {
  const seen = new Set<string>([fullSig(new CubeState())]);
  const queue: { seq: string; key: string }[] = [{ seq: "", key: fullSig(new CubeState()) }];
  const out: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur.seq);
    for (const m of ["x", "y", "z"]) {
      const seq = (cur.seq + " " + m).trim();
      const c = new CubeState();
      c.applySequence(seq);
      const k = fullSig(c);
      if (!seen.has(k)) { seen.add(k); queue.push({ seq, key: k }); }
    }
  }
  return out;
}
const ROTS = genRotations();

function rotOfSolved(c: CubeState): string | null {
  const key = fullSig(c);
  for (const r of ROTS) {
    const t = new CubeState();
    if (r) t.applySequence(r);
    if (fullSig(t) === key) return r;
  }
  return null;
}

// ── Detección por color con las 24 rotaciones del timeline ────────────────
function detectWithRotations(states: CubeState[]) {
  let best: ReturnType<typeof ColorPhaseDetector.detect> = null;
  let bestRot = "";
  for (const r of ROTS) {
    const rotated = states.map((s) => {
      const t = s.clone();
      if (r) t.applySequence(r);
      return t;
    });
    const res = ColorPhaseDetector.detect(rotated);
    if (!res) continue;
    const score = (() => {
      const n = res.completions.filter((c) => c >= 0).length;
      const spurious = res.completions[1] >= states.length - 1 || res.completions[2] >= states.length - 1;
      return (n * 1000) - (spurious ? 500 : 0) - res.completions[0];
    })();
    const bestScore = best ? (() => {
      const n = best.completions.filter((c) => c >= 0).length;
      const spurious = best.completions[1] >= states.length - 1 || best.completions[2] >= states.length - 1;
      return (n * 1000) - (spurious ? 500 : 0) - best.completions[0];
    })() : -Infinity;
    if (score > bestScore) { best = res; bestRot = r; }
  }
  return { best, bestRot };
}

function analyze(label: string, phases: string[]) {
  const state = new CubeState();
  state.applySequence(SCRAMBLE);
  const states: CubeState[] = [];
  let nFace = 0, nRot = 0;
  for (const ph of phases) {
    for (const t of tokenize(ph)) {
      if (/^[xyz]/.test(t)) nRot++;
      else nFace++;
      state.applySequence(t);
      states.push(state.clone());
    }
  }
  const final = states[states.length - 1];
  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`${label}`);
  console.log(`════════════════════════════════════════════════════════`);
  console.log(`tokens: ${states.length} (${nFace} STM + ${nRot} rotaciones)`);
  console.log(`final isSolved: ${final.isSolved()} · rot-de-solved: ${rotOfSolved(final) ?? "NONE"}`);

  // Detección directa (sin rotación)
  const direct = ColorPhaseDetector.detect(states);
  console.log(`\n[detector directo] ${direct ? `crossFace=${direct.crossFace} crossColor=${direct.crossColor} completions=[${direct.completions.map((c, i) => c < 0 ? "-" : (["cross","f2l","oll","pll"][i] + "@" + (c + 1))).join(", ")}]` : "null (sin cross detectada)"}`);

  // Detección con 24 rotaciones
  const { best, bestRot } = detectWithRotations(states);
  console.log(`[detector 24-rot] rot=${bestRot || "∅"} → ${best ? `crossFace=${best.crossFace} completions=[${best.completions.map((c, i) => c < 0 ? "-" : (["cross","f2l","oll","pll"][i] + "@" + (c + 1))).join(", ")}]` : "null"}`);

  // Comparación con las fases anotadas (índices de token 1-based)
  console.log(`\nFases anotadas por CubeRoot (índices de token):`);
  let idx = 0;
  for (const ph of ANNOTATED) {
    const toks = tokenize(ph.moves);
    const start = idx + 1;
    const end = idx + toks.length;
    console.log(`  ${ph.name.padEnd(18)} movs ${String(start).padStart(2)}–${String(end).padStart(2)} (${toks.length}m) [${ph.moves}]`);
    idx = end;
  }
  // Índices de "moves excl. rotaciones" de CubeRoot (los counts de la página)
  console.log(`\nCuenta de CubeRoot por fase (excl. rotaciones): ${ANNOTATED.map((p) => p.count).join(" + ")} = ${ANNOTATED.reduce((s, p) => s + p.count, 0)}`);
  console.log(`(la página dice 58 moves; nuestra lectura del stream da 61 STM)`);
}

analyze("VERSIÓN USER (pegada — sin inspección)", [
  "D2 L U R' U'",
  "D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U' L U' L'",
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
]);

analyze("VERSIÓN OLD (con inspección z y + x' en F2L1)", SOLVE_OLD);
