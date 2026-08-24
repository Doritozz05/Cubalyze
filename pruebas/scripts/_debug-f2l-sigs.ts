/**
 * Debug F2L: por qué no matchean las firmas del solve 2510 vs catálogo.
 * Imprime firmas crudas de cada pre-estado y de los casos del catálogo.
 */
import { CubeState, FaceletStringConverter } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
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
];

// ── Replay literal ─────────────────────────────────────────────────────────
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

// ── Geometría ──────────────────────────────────────────────────────────────
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
const D_OFFSET = 27;
const isD = (i: number) => i >= 27 && i < 36;
const D_EDGES = [4, 5, 6, 7];
const D_CORNERS = [4, 5, 6, 7];
const M_EDGES = [8, 9, 10, 11];
const AUFS = ["", "U", "U2", "U'"];

const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s).split("");

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

function cornerRole(fl: string[], p: number): string {
  const side = cornerFacelet[p].filter((i) => !isD(i) && faceOfFacelet(i) !== "U");
  return side.map((i) => fl[i]).sort().join("");
}
function mEdgeRole(fl: string[], p: number): string {
  const [a, b] = edgeFacelet[p];
  return [fl[a], fl[b]].sort().join("");
}

function crossOnD(s: CubeState, fl: string[]): boolean {
  const first = edgeFacelet[D_EDGES[0]];
  const c = fl[isD(first[0]) ? first[0] : first[1]];
  for (const p of D_EDGES) {
    const [a, b] = edgeFacelet[p];
    const di = isD(a) ? a : b;
    if (fl[di] !== c || s.eo[p] !== 0) return false;
  }
  return true;
}
function normalizeToD(s: CubeState): { state: CubeState; rot: string }[] {
  const out: { state: CubeState; rot: string }[] = [];
  for (const r of ROTS) {
    const t = r ? s.clone() : s;
    if (r) t.applySequence(r);
    if (crossOnD(t, flOf(t))) out.push({ state: t, rot: r });
  }
  return out;
}

const OPPOSITE: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
const crossEdgePositions: Record<string, number[]> = {
  U: [1, 0, 3, 2], D: [5, 4, 7, 6], F: [1, 5, 8, 9], B: [3, 7, 11, 10], R: [0, 4, 8, 11], L: [2, 6, 9, 10],
};
function edgeColorOf(s: CubeState, pos: number): string[] {
  const EDGE_COLORS: string[][] = [
    ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
    ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
  ];
  return EDGE_COLORS[s.ep[pos]];
}
function edgeColorOfPosition(pos: number): string[] {
  const EDGE_POS_COLORS: string[][] = [
    ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
    ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
  ];
  return EDGE_POS_COLORS[pos];
}
function deriveScheme(s: CubeState, fl: string[]): Record<string, string> | null {
  const crossFace = "D";
  const first = edgeFacelet[D_EDGES[0]];
  const crossColor = fl[isD(first[0]) ? first[0] : first[1]];
  const scheme: Record<string, string> = { D: crossColor };
  for (const pos of crossEdgePositions[crossFace]) {
    const pieceColors = edgeColorOf(s, pos);
    const sideColor = pieceColors[0] === crossColor ? pieceColors[1] : pieceColors[0];
    const posColors = edgeColorOfPosition(pos);
    const sideFace = posColors[0] === crossFace ? posColors[1] : posColors[0];
    if (scheme[sideFace] !== undefined && scheme[sideFace] !== sideColor) return null;
    scheme[sideFace] = sideColor;
  }
  const assigned = new Set(Object.values(scheme));
  const remaining = "URFDLB".split("").find((f) => !assigned.has(f));
  if (remaining === undefined) return null;
  scheme[OPPOSITE[crossFace]] = remaining;
  if (new Set(Object.values(scheme)).size !== 6) return null;
  return scheme;
}
function recolorToCanonical(s: CubeState): { state: CubeState | null; scheme: Record<string, string> | null; rot: string }[] {
  const out: { state: CubeState | null; scheme: Record<string, string> | null; rot: string }[] = [];
  for (const { state: norm, rot } of normalizeToD(s)) {
    const fl = flOf(norm);
    const scheme = deriveScheme(norm, fl);
    if (scheme === null) { out.push({ state: null, scheme: null, rot }); continue; }
    for (let k = 0; k < 4; k++) {
      const inverse: Record<string, string> = {};
      const eff = { ...scheme };
      if (k > 0) {
        const sideFaces = ["F", "R", "B", "L"];
        const colors = sideFaces.map((f) => scheme[f]);
        sideFaces.forEach((f, j) => { eff[f] = colors[(j + k) % 4]; });
      }
      for (const f of "URFDLB".split("")) inverse[eff[f]] = f;
      const mapped = fl.map((c) => inverse[c] ?? c).join("");
      try {
        out.push({ state: FaceletStringConverter.fromFaceletString(mapped), scheme: eff, rot: `${rot} AUF${k}` });
      } catch { /* inválido */ }
    }
  }
  return out;
}

function f2lSigEntries(s: CubeState): string {
  const fl = flOf(s);
  const entries: string[] = [];
  for (const p of D_CORNERS) entries.push(`C${cornerRole(fl, p)}@${p}#${s.co[p]}`);
  for (const p of M_EDGES) entries.push(`E${mEdgeRole(fl, p)}@${p}#${s.eo[p]}`);
  return entries.sort().join("|");
}

function f2lSig(s: CubeState): string | null {
  let best: string | null = null;
  for (const { state: canon } of recolorToCanonical(s)) {
    if (canon === null) continue;
    for (const a of AUFS) {
      const t = canon.clone();
      if (a) t.applySequence(a);
      const key = f2lSigEntries(t);
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

// ── Diagnóstico ────────────────────────────────────────────────────────────
const ANNOT = ["F2L 39", "F2L 11", "F2L 1", "F2L 18"];

for (let k = 0; k < 4; k++) {
  // pre-estado de la fase F2L k+1 (fase index 2+k)
  const pre = states[phaseStart[2 + k] - 1];
  const sig = f2lSig(pre);
  const norms = normalizeToD(pre);
  const rec = recolorToCanonical(pre);
  console.log(`\n=== F2L ${k + 1} (anotado ${ANNOT[k]}) ===`);
  console.log(`  normalizeToD: ${norms.length} rotaciones [${norms.map((n) => n.rot || "∅").join(", ")}]`);
  console.log(`  recolor: ${rec.length} variantes válidas`);
  if (rec[0]?.state) console.log(`  facelets canon: ${FaceletStringConverter.toFaceletString(rec[0].state)}`);
  console.log(`  SIG = ${sig}`);

  // casos del catálogo
  const cat = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === ANNOT[k])!;
  const catState = CaseStateGenerator.generateFromScramble(cat.caseDef.setupScramble);
  const catSig = f2lSig(catState);
  const catNorms = normalizeToD(catState);
  console.log(`  catálogo ${ANNOT[k]} setup="${cat.caseDef.setupScramble}"`);
  console.log(`    normalizeToD: ${catNorms.length} · SIG = ${catSig}`);
  console.log(`    facelets: ${FaceletStringConverter.toFaceletString(catState)}`);
  console.log(`  ¿coinciden? ${sig === catSig ? "✅ SÍ" : "❌ NO"}`);
}

// Cruz: qué rotaciones usa el detector para la fase 0
console.log(`\n=== CROSS (fase 1) ===`);
const crossPre = states[phaseStart[1] - 1];
const crossPost = states[phaseStart[2] - 1];
console.log(`  pre-cross  facelets: ${FaceletStringConverter.toFaceletString(crossPre)}`);
console.log(`  post-cross facelets: ${FaceletStringConverter.toFaceletString(crossPost)}`);
for (const [name, st] of [["pre", crossPre], ["post", crossPost]] as const) {
  const norms = normalizeToD(st);
  console.log(`  ${name}-cross: normalizeToD → ${norms.length} [${norms.map((n) => n.rot || "∅").join(", ")}]`);
  const fl = flOf(st);
  for (const f of "URFDLB".split("")) {
    const edges = crossEdgePositions[f];
    const colors = edges.map((p) => {
      const [a, b] = edgeFacelet[p];
      const di = faceOfFacelet(a) === f ? a : b;
      return fl[di];
    });
    console.log(`    cara ${f}: aristas cross = [${colors.join(",")}]`);
  }
}
