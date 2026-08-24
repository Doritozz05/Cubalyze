/** Depuración slots EXHAUSTIVA: 24 rotaciones × 4 AUF de esquema, maximiza slots.
 * Objetivo: dirimir la discrepancia de slots entre CubeRoot (BO/GR/BR/GO) y
 * speedcube.quest (BL/FR/FL/BR). */
import { CubeState, FaceletStringConverter } from "../../packages/math-core/src/index";

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

const states: CubeState[] = [];
const s = new CubeState();
s.applySequence(SCRAMBLE);
for (const ph of PHASES) {
  for (const t of tokenize(ph)) s.applySequence(t);
  states.push(s.clone());
}

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

const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const isD = (i: number) => i >= 27 && i < 36;
const D_EDGES = [4, 5, 6, 7];
const EDGE_COLORS: string[][] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
  ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];
const OPPOSITE: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
const crossEdgePositions: Record<string, number[]> = {
  U: [1, 0, 3, 2], D: [5, 4, 7, 6], F: [1, 5, 8, 9], B: [3, 7, 11, 10], R: [0, 4, 8, 11], L: [2, 6, 9, 10],
};
const flOf = (st: CubeState) => FaceletStringConverter.toFaceletString(st).split("");

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

/** Para un estado rotado con cross en D: qué slots (por color de par) están completos. */
function slotsInRotated(t: CubeState): { slots: string[]; scheme: Record<string, string> | null } {
  const fl = flOf(t);
  const scheme = deriveScheme(t, fl);
  if (scheme === null) return { slots: [], scheme: null };
  // El slot en la posición D-corner p toca las caras laterales que el par
  // color-de-la-cross + 2 colores laterales. Identificamos el par por sus
  // colores laterales (los 2 colores de la esquina que no son el de la cross).
  const crossColor = scheme.D;
  const names = ["FR", "FL", "BL", "BR"];
  const cPos = [4, 5, 6, 7];
  const ePos = [8, 9, 10, 11];
  const cornerSide = (p: number): string[] => {
    // colores de los 2 facelets laterales de la esquina en p
    const side = cornerFacelet[p].filter((i) => !isD(i) && i < 27 && i >= 18 ? true : !isD(i) && faceOf(i) !== "U");
    return side.map((i) => fl[i]).sort();
  };
  const faceOf = (i: number): string =>
    i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = cPos[i];
    const e = ePos[i];
    const cs = cornerSide(p);
    const es = [edgeFacelet[e][0], edgeFacelet[e][1]].map((x) => fl[x]).sort();
    const cHome = t.cp[p] === p && t.co[p] === 0;
    const eHome = t.ep[e] === e && t.eo[e] === 0;
    if (cHome && eHome) out.push(names[i]);
  }
  return { slots: out, scheme };
}

// Búsqueda exhaustiva por fase
let prevSlots: string[] = [];
for (let i = 0; i < states.length; i++) {
  let best: { slots: string[]; rot: string; rotScheme: number } | null = null;
  for (const r of ROTS) {
    const t = r ? states[i].clone() : states[i];
    if (r) t.applySequence(r);
    if (!crossOnD(t, flOf(t))) continue;
    // probar las 4 rotaciones de esquema no afecta a los slots por pieza,
    // pero la cross desalineada sí: probamos rotaciones y del frame (24 ya cubre)
    const { slots } = slotsInRotated(t);
    const score = slots.length;
    if (best === null || score > best.slots.length) best = { slots, rot: r, rotScheme: 0 };
  }
  const slots = best?.slots ?? [];
  const newly = slots.filter((x) => !prevSlots.includes(x));
  console.log(`Fase ${i} (${PHASES[i].slice(0, 34).padEnd(36)}) rot=${String(best?.rot ?? "NONE").padEnd(9)} slots=[${slots.join(",")}] ${newly.length ? `→ NUEVO: ${newly.join(",")}` : ""}`);
  prevSlots = slots;
}
