/** Depuración: firma del pre-estado F2L1 del solve vs catálogo F2L 39. */
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

function cornerRole(fl: string[], p: number): string {
  const side = cornerFacelet[p].filter((i) => !isD(i) && faceOfFacelet(i) !== "U");
  return side.map((i) => fl[i]).sort().join("");
}
function mEdgeRole(fl: string[], p: number): string {
  const [a, b] = edgeFacelet[p];
  return [fl[a], fl[b]].sort().join("");
}

function f2lSig(state: CubeState): { sig: string; details: string[] } | null {
  const norms = normalizeToD(state);
  if (!norms.length) return null;
  let best: { sig: string; det: string } | null = null;
  for (const { state: norm, rot } of norms) {
    for (const a of AUFS) {
      const t = norm.clone();
      if (a) t.applySequence(a);
      const fl = flOf(t);
      const entries: string[] = [];
      for (const p of D_CORNERS) entries.push(`C${cornerRole(fl, p)}@${p}#${t.co[p]}`);
      for (const p of M_EDGES) entries.push(`E${mEdgeRole(fl, p)}@${p}#${t.eo[p]}`);
      const key = entries.sort().join("|");
      if (best === null || key < best.sig) best = { sig: key, det: `rot=${rot} auf=${a || "∅"} | ${entries.sort().join(" | ")}` };
    }
  }
  return { sig: best!.sig, details: [best!.det] };
}

// ── Solve: pre-estado de F2L 1 ─────────────────────────────────────────────
const s = new CubeState();
s.applySequence(SCRAMBLE);
s.applySequence(tokenize("z y").join(" "));
s.applySequence(tokenize("D2 L U R' U'").join(" "));
console.log("=== Solve pre-F2L1 ===");
console.log("facelets:", FaceletStringConverter.toFaceletString(s));
console.log("ep:", Array.from(s.ep), "eo:", Array.from(s.eo));
const solveSig = f2lSig(s);
console.log("f2lSig:", solveSig ? solveSig.sig : "NULL");
if (solveSig) for (const d of solveSig.details) console.log("  ", d);

// ── Catálogo F2L 39 ────────────────────────────────────────────────────────
const c39 = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === "F2L 39");
console.log("\n=== Catálogo F2L 39 (setup:", c39?.caseDef.setupScramble, ") ===");
if (c39) {
  const g = CaseStateGenerator.generateFromScramble(c39.caseDef.setupScramble);
  console.log("facelets:", FaceletStringConverter.toFaceletString(g));
  const catSig = f2lSig(g);
  console.log("f2lSig:", catSig ? catSig.sig : "NULL");
  if (catSig) for (const d of catSig.details) console.log("  ", d);
}

// ── Catálogo F2L 1 (Jb) ────────────────────────────────────────────────────
const c1 = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === "F2L 1");
console.log("\n=== Catálogo F2L 1 (setup:", c1?.caseDef.setupScramble, ") ===");
if (c1) {
  const g = CaseStateGenerator.generateFromScramble(c1.caseDef.setupScramble);
  const catSig = f2lSig(g);
  console.log("f2lSig:", catSig ? catSig.sig : "NULL");
  if (catSig) for (const d of catSig.details) console.log("  ", d);
}
