/** Depuración: firma re-coloreada del pre-F2L1 del solve vs catálogo F2L 39. */
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
const D_EDGES = [4, 5, 6, 7];
const D_CORNERS = [4, 5, 6, 7];
const M_EDGES = [8, 9, 10, 11];
const AUFS = ["", "U", "U2", "U'"];

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
const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s).split("");

function crossOnD(state: CubeState, fl: string[]): boolean {
  const first = edgeFacelet[D_EDGES[0]];
  const c = fl[isD(first[0]) ? first[0] : first[1]];
  for (const p of D_EDGES) {
    const [a, b] = edgeFacelet[p];
    const di = isD(a) ? a : b;
    if (fl[di] !== c || state.eo[p] !== 0) return false;
  }
  return true;
}
function normalizeToD(state: CubeState): { state: CubeState; rot: string }[] {
  const out: { state: CubeState; rot: string }[] = [];
  for (const r of ROTS) {
    const t = r ? state.clone() : state;
    if (r) t.applySequence(r);
    if (crossOnD(t, flOf(t))) out.push({ state: t, rot: r });
  }
  return out;
}

const EDGE_COLORS: string[][] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
  ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];
const OPPOSITE: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
const crossEdgePositions: Record<string, number[]> = {
  U: [1, 0, 3, 2], D: [5, 4, 7, 6], F: [1, 5, 8, 9], B: [3, 7, 11, 10], R: [0, 4, 8, 11], L: [2, 6, 9, 10],
};

function deriveScheme(state: CubeState, fl: string[]): Record<string, string> | null {
  const crossFace = "D";
  const first = edgeFacelet[D_EDGES[0]];
  const crossColor = fl[isD(first[0]) ? first[0] : first[1]];
  const scheme: Record<string, string> = { D: crossColor };
  for (const pos of crossEdgePositions[crossFace]) {
    const pieceColors = EDGE_COLORS[state.ep[pos]];
    const sideColor = pieceColors[0] === crossColor ? pieceColors[1] : pieceColors[0];
    const posColors = EDGE_COLORS[pos];
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

function recolorToCanonical(state: CubeState): CubeState | null {
  const fl = flOf(state);
  const scheme = deriveScheme(state, fl);
  if (scheme === null) { console.log("    [deriveScheme NULL] fl=", fl.join("")); return null; }
  const inverse: Record<string, string> = {};
  for (const f of "URFDLB".split("")) inverse[scheme[f]] = f;
  const mapped = fl.map((c) => inverse[c] ?? c).join("");
  console.log("    scheme:", JSON.stringify(scheme));
  console.log("    recolored:", mapped);
  try {
    return FaceletStringConverter.fromFaceletString(mapped);
  } catch (e) {
    console.log("    [fromFaceletString ERROR]", String(e).slice(0, 100));
    return null;
  }
}

function cornerRole(fl: string[], p: number): string {
  const side = cornerFacelet[p].filter((i) => !isD(i) && faceOfFacelet(i) !== "U");
  return side.map((i) => fl[i]).sort().join("");
}
function mEdgeRole(fl: string[], p: number): string {
  const [a, b] = edgeFacelet[p];
  return [fl[a], fl[b]].sort().join("");
}

function f2lSig(state: CubeState): string | null {
  let best: string | null = null;
  const norms = normalizeToD(state);
  console.log(`    normalizeToD: ${norms.length} frames`);
  for (const { state: norm, rot } of norms) {
    console.log(`    rot=${rot} fl=${flOf(norm).join("")}`);
    const canon = recolorToCanonical(norm);
    if (canon === null) continue;
    for (const a of AUFS) {
      const t = canon.clone();
      if (a) t.applySequence(a);
      const fl = flOf(t);
      const entries: string[] = [];
      for (const p of D_CORNERS) entries.push(`C${cornerRole(fl, p)}@${p}#${t.co[p]}`);
      for (const p of M_EDGES) entries.push(`E${mEdgeRole(fl, p)}@${p}#${t.eo[p]}`);
      const key = entries.sort().join("|");
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

// Solve pre-F2L1
const s = new CubeState();
s.applySequence(SCRAMBLE);
s.applySequence(tokenize("z y").join(" "));
s.applySequence(tokenize("D2 L U R' U'").join(" "));
console.log("=== Solve pre-F2L1 ===");
console.log("facelets:", FaceletStringConverter.toFaceletString(s));
const sig1 = f2lSig(s);
console.log("f2lSig:", sig1);

// Catálogo F2L 39
const c39 = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === "F2L 39");
console.log("\n=== Catálogo F2L 39 ===");
if (c39) {
  const g = CaseStateGenerator.generateFromScramble(c39.caseDef.setupScramble);
  console.log("facelets:", FaceletStringConverter.toFaceletString(g));
  const sig2 = f2lSig(g);
  console.log("f2lSig:", sig2);
  console.log("MATCH:", sig1 === sig2);
}
