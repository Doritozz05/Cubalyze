/** Debug: firmas del par F2L (frame solver + slot→FR) y PLL del 2510. */
import { CubeState, FaceletStringConverter } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
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
  "z y", "D2 L U R' U'", "x' D' L' U L U' L' U L D", "U2 y' L' U L U' L' U L U2 L' U L",
  "U2 U L U' L'", "y' R' U2 R U R' U' R", "R' U' R' F R F' U R", "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
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

const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s).split("");

function solverFrameRotations(st: CubeState): string[] {
  const out: string[] = [];
  for (const r of ROTS) {
    const t = r ? st.clone() : st;
    if (r) t.applySequence(r);
    const dEdges = Array.from(t.ep).slice(4, 8);
    const dEo = Array.from(t.eo).slice(4, 8);
    if (dEdges.every((p) => p >= 0 && p <= 3) && dEo.every((e) => e === 0)) out.push(r);
  }
  return out;
}

const SLOT_ROT: Record<string, string> = { FR: "", FL: "y", BL: "y2", BR: "y'" };
const SLOT_ORDER = ["FR", "FL", "BL", "BR"] as const;

function pairSig(s: CubeState, crossColor: string): string | null {
  const fl = flOf(s);
  let cornerPos = -1, edgePos = -1;
  for (let p = 0; p < 8; p++) {
    const colors = cornerFacelet[p].map((i) => fl[i]);
    if (colors.includes(crossColor) && colors.includes("F") && colors.includes("R")) { cornerPos = p; break; }
  }
  for (let p = 0; p < 12; p++) {
    const [a, b] = edgeFacelet[p];
    const colors = [fl[a], fl[b]];
    if (colors.includes("F") && colors.includes("R") && !colors.includes(crossColor)) { edgePos = p; break; }
  }
  if (cornerPos < 0 || edgePos < 0) return null;
  return `C${cornerPos}#${s.co[cornerPos]}|E${edgePos}#${s.eo[edgePos]}`;
}
function pairDetail(s: CubeState, crossColor: string): string {
  const fl = flOf(s);
  const parts: string[] = [];
  for (let p = 0; p < 8; p++) {
    const colors = cornerFacelet[p].map((i) => fl[i]).sort().join("");
    if (colors.includes(crossColor) && colors.includes("F") && colors.includes("R")) {
      parts.push(`esquina(blanca) en ${p} co=${s.co[p]} [${colors}]`);
    }
  }
  for (let p = 0; p < 12; p++) {
    const [a, b] = edgeFacelet[p];
    const colors = [fl[a], fl[b]].sort().join("");
    if (colors.includes("F") && colors.includes("R") && !colors.includes(crossColor)) {
      parts.push(`arista FR en ${p} eo=${s.eo[p]}`);
    }
  }
  return parts.join(" · ") || "(no encontrado)";
}

function pllSig(s: CubeState): string {
  let best: string | null = null;
  for (const a of ["", "U", "U2", "U'"]) {
    const t = s.clone();
    if (a) t.applySequence(a);
    const key = `${Array.from(t.cp).slice(0, 4).join(",")}|${Array.from(t.ep).slice(0, 4).join(",")}`;
    if (best === null || key < best) best = key;
  }
  return best!;
}

// Catálogo: firmas de los casos anotados
const ANNOT = ["F2L 39", "F2L 11", "F2L 1", "F2L 18"];
console.log("=== Catálogo: firmas del par de los casos anotados ===");
for (const num of ANNOT) {
  const c = ALL_F2L_CASES.find((x) => x.caseDef.caseNumber === num)!;
  const st = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  console.log(`${num} setup="${c.caseDef.setupScramble}" → sig=${pairSig(st, "D")} | ${pairDetail(st, "D")}`);
  console.log(`   facelets: ${FaceletStringConverter.toFaceletString(st)}`);
}

console.log("\n=== Solve: par por fase (frame del solver × slot→FR) ===");
for (let k = 2; k <= 5; k++) {
  const pre = states[phaseStart[k] - 1];
  const frames = solverFrameRotations(pre);
  console.log(`\nF2L ${k - 1} (anotado ${ANNOT[k - 2]}) · frames=${frames.length} [${frames.map((f) => f || "∅").join(", ")}]`);
  for (const r of frames) {
    for (const S of SLOT_ORDER) {
      const t = pre.clone();
      if (r) t.applySequence(r);
      if (SLOT_ROT[S]) t.applySequence(SLOT_ROT[S]);
      const sig = pairSig(t, "U");
      console.log(`  rot=${r || "∅"} slot=${S} → sig=${sig} | ${pairDetail(t, "U")}`);
    }
  }
}

// PLL
console.log("\n=== PLL ===");
const prePll = states[phaseStart[7] - 1];
console.log(`frames PLL: [${solverFrameRotations(prePll).map((f) => f || "∅").join(", ")}]`);
for (const r of solverFrameRotations(prePll)) {
  const t = prePll.clone();
  if (r) t.applySequence(r);
  console.log(`  rot=${r || "∅"} pllSig=${pllSig(t)} · cp[0..3]=[${Array.from(t.cp).slice(0, 4).join(",")}] co=[${Array.from(t.co).slice(0, 4).join(",")}] ep[0..3]=[${Array.from(t.ep).slice(0, 4).join(",")}]`);
}
for (const name of ["Ga", "Gb", "Gc", "Gd", "Ua", "Ub", "H", "Z", "T", "Jb"]) {
  const c = PLL_CASES.find((x) => x.caseDef.caseNumber === name)!;
  const st = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  console.log(`  catálogo ${name}: pllSig=${pllSig(st)}`);
}
