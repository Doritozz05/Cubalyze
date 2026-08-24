/** Debug: PLL pre-estado del 2510 — frame solver, con/sin recolor. */
import { CubeState, FaceletStringConverter } from "../../packages/math-core/src/index";
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
function recolorSwap(s: CubeState): CubeState {
  const fl = FaceletStringConverter.toFaceletString(s).split("").map((c) => (c === "U" ? "D" : c === "D" ? "U" : c));
  return FaceletStringConverter.fromFaceletString(fl.join(""));
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

const prePll = states[phaseStart[7] - 1];
console.log(`pre-PLL world facelets: ${FaceletStringConverter.toFaceletString(prePll)}`);
console.log(`frames: [${solverFrameRotations(prePll).map((f) => f || "∅").join(", ")}]`);

for (const r of solverFrameRotations(prePll)) {
  const t = prePll.clone();
  if (r) t.applySequence(r);
  console.log(`\nrot=${r || "∅"}`);
  console.log(`  SIN recolor: pllSig=${pllSig(t)} · cp=[${Array.from(t.cp).slice(0, 4)}] ep=[${Array.from(t.ep).slice(0, 4)}] co=[${Array.from(t.co).slice(0, 4)}]`);
  const rc = recolorSwap(t);
  console.log(`  CON recolor: pllSig=${pllSig(rc)} · cp=[${Array.from(rc.cp).slice(0, 4)}] ep=[${Array.from(rc.ep).slice(0, 4)}] co=[${Array.from(rc.co).slice(0, 4)}]`);
  console.log(`  facelets: ${FaceletStringConverter.toFaceletString(t)}`);
}

// ¿Qué patrón sería Gd tras recolor? Catálogo
for (const name of ["Ga", "Gb", "Gc", "Gd"]) {
  const c = PLL_CASES.find((x) => x.caseDef.caseNumber === name)!;
  const st = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  console.log(`catálogo ${name}: pllSig=${pllSig(st)} · cp=[${Array.from(st.cp).slice(0, 4)}] ep=[${Array.from(st.ep).slice(0, 4)}]`);
}

// Verificar: ¿el alg PLL resuelve el pre-estado?
console.log(`\nVerificación: aplicar el alg de PLL al pre-estado world:`);
const v = prePll.clone();
for (const m of tokenize(PHASES[7])) v.applySequence(m);
console.log(`  tras alg: isSolved=${v.isSolved()} rotDeSolved=${(() => {
  const key = fullSig(v);
  for (const r of ROTS) { const t = new CubeState(); if (r) t.applySequence(r); if (fullSig(t) === key) return r; }
  return null;
})()}`);
