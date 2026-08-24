/** Debug: slots F2L (frame bestRot) y PLL (frame bestRot+x2) del 2510. */
import { CubeState, ColorPhaseDetector, FaceletStringConverter } from "../../packages/math-core/src/index";
import { PLL_CASES } from "../../packages/algorithm-db/src/seed/cfop-pll";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const PHASES = [
  "z y",
  "D2 L U R' U'",
  "x' D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U2 U L U' L'",
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
];

const fullSig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}|${Array.from(c.co).join(",")}|${Array.from(c.eo).join(",")}`;
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

// Replay
const allTokens: string[] = [];
const phaseStart = [0];
for (const ph of PHASES) {
  const toks = tokenize(ph);
  allTokens.push(...toks);
  phaseStart.push(allTokens.length);
}
const state = new CubeState();
state.applySequence(SCRAMBLE);
const states: CubeState[] = [];
for (const t of allTokens) {
  state.applySequence(t);
  states.push(state.clone());
}
console.log("final isSolved:", states[states.length - 1].isSolved());

// bestRot
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
  const score = res.completions.filter((c) => c >= 0).length * 100 - res.completions[0];
  const bScore = best ? best.completions.filter((c) => c >= 0).length * 100 - best.completions[0] : -Infinity;
  if (score > bScore) { best = res; bestRot = r; }
}
console.log("bestRot:", bestRot || "∅", best ? `crossFace=${best.crossFace} c@${best.completions[0] + 1} f@${best.completions[1] + 1} o@${best.completions[2] + 1} p@${best.completions[3] + 1}` : "null");

const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const faceOfFacelet = (i: number): string =>
  i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
const isD = (i: number) => i >= 27 && i < 36;
const U_CORNERS = [0, 1, 2, 3];
const M_EDGES = [8, 9, 10, 11];

const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s).split("");
function cornerRole(fl: string[], p: number): string {
  const side = cornerFacelet[p].filter((i) => faceOfFacelet(i) !== "U" && faceOfFacelet(i) !== "D");
  return side.map((i) => fl[i]).sort().join("");
}
function edgeRole(fl: string[], p: number): string {
  const [a, b] = edgeFacelet[p];
  return [fl[a], fl[b]].sort().join("");
}

const SLOT_ROLE: Record<string, { cPos: number; cRole: string; ePos: number; eRole: string }> = {
  FR: { cPos: 0, cRole: "FR", ePos: 8, eRole: "FR" },
  FL: { cPos: 1, cRole: "FL", ePos: 9, eRole: "FL" },
  BL: { cPos: 2, cRole: "BL", ePos: 10, eRole: "BL" },
  BR: { cPos: 3, cRole: "BR", ePos: 11, eRole: "BR" },
};

function dumpSlots(label: string, s: CubeState) {
  const fl = flOf(s);
  console.log(`\n${label} facelets: ${fl.join("")}`);
  console.log(`  centros: U=${fl[4]} R=${fl[13]} F=${fl[22]} D=${fl[31]} L=${fl[40]} B=${fl[49]}`);
  for (const slot of Object.keys(SLOT_ROLE)) {
    const { cPos, cRole, ePos, eRole } = SLOT_ROLE[slot];
    const cr = cornerRole(fl, cPos);
    const er = edgeRole(fl, ePos);
    const ok = cr === cRole && s.co[cPos] === 0 && er === eRole && s.eo[ePos] === 0;
    console.log(`  slot ${slot}: C${cPos} rol=${cr} co=${s.co[cPos]} · E${ePos} rol=${er} eo=${s.eo[ePos]} ${ok ? "✓" : ""}`);
  }
  // esquinas blancas (contienen 'U')
  for (let p = 0; p < 8; p++) {
    const colors = cornerFacelet[p].map((i) => fl[i]).sort().join("");
    if (colors.includes("U") && colors.length === 3) {
      console.log(`  esquina blanca en pos ${p}: [${colors}] co=${s.co[p]}`);
    }
  }
  // aristas coloreadas (sin U ni D)
  for (let p = 0; p < 12; p++) {
    const [a, b] = edgeFacelet[p];
    const cs = [fl[a], fl[b]].sort().join("");
    if (!cs.includes("U") && !cs.includes("D")) {
      console.log(`  arista coloreada en pos ${p}: [${cs}] eo=${s.eo[p]}`);
    }
  }
}

for (let k = 2; k <= 5; k++) {
  const pre = states[phaseStart[k] - 1];
  const post = states[phaseStart[k + 1] - 1];
  const canonPre = pre.clone();
  if (bestRot) canonPre.applySequence(bestRot);
  const canonPost = post.clone();
  if (bestRot) canonPost.applySequence(bestRot);
  console.log(`\n========== F2L ${k - 1} (${PHASES[k]}) ==========`);
  dumpSlots("  PRE (canónico)", canonPre);
  dumpSlots("  POST (canónico)", canonPost);
}

// PLL: pre en frame x2
console.log(`\n========== PLL ==========`);
const pllPre = states[phaseStart[7] - 1];
const ll = pllPre.clone();
if (bestRot) ll.applySequence(bestRot);
ll.applySequence("x2");
const fl = flOf(ll);
console.log(`pre-PLL facelets (x2): ${fl.join("")}`);
console.log(`  U-corners cp[0..3] = [${Array.from(ll.cp).slice(0, 4).join(",")}] co=[${Array.from(ll.co).slice(0, 4).join(",")}]`);
console.log(`  U-edges   ep[0..3] = [${Array.from(ll.ep).slice(0, 4).join(",")}] eo=[${Array.from(ll.eo).slice(0, 4).join(",")}]`);
const gd = PLL_CASES.find((c) => c.caseDef.caseNumber === "Gd")!;
const gdState = CaseStateGenerator.generateFromScramble(gd.caseDef.setupScramble);
console.log(`catálogo Gd setup="${gd.caseDef.setupScramble}"`);
console.log(`  U-corners cp[0..3] = [${Array.from(gdState.cp).slice(0, 4).join(",")}] co=[${Array.from(gdState.co).slice(0, 4).join(",")}]`);
console.log(`  U-edges   ep[0..3] = [${Array.from(gdState.ep).slice(0, 4).join(",")}] eo=[${Array.from(gdState.eo).slice(0, 4).join(",")}]`);
console.log(`  facelets: ${FaceletStringConverter.toFaceletString(gdState)}`);
