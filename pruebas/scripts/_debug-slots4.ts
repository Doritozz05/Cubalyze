/**
 * Slots por PARES DE COLOR FÍSICOS (notación CubeRoot: BO/GR/BR/GO).
 * Sin esquema ni re-colorado: para cada posición D-corner leemos los 2 colores
 * de sus facelets laterales (los que no son la cara de la cross). El par está
 * resuelto si la esquina muestra el color de la cross hacia D (es una esquina
 * de la capa de la cross orientada) y la arista del ecuador con ese par de
 * colores está en su posición.
 */
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
const faceOf = (i: number): string =>
  i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
const D_OFFSET = 27;
const isD = (i: number) => i >= 27 && i < 36;
const D_EDGES = [4, 5, 6, 7];
const D_CORNERS = [4, 5, 6, 7];
const M_EDGES = [8, 9, 10, 11];

/** Cross completa en D (cualquier color): 4 aristas D del mismo color, eo=0. */
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

/** Pares de color de los 4 huecos D en el frame actual (cross en D). */
function dSlots(t: CubeState, fl: string[]): { pair: string; solved: boolean }[] {
  const crossFirst = edgeFacelet[D_EDGES[0]];
  const crossColor = fl[isD(crossFirst[0]) ? crossFirst[0] : crossFirst[1]];
  const out: { pair: string; solved: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const p = D_CORNERS[i];
    const e = M_EDGES[i];
    // Colores laterales de la esquina en p (los facelets que no son D ni cross)
    const lat = cornerFacelet[p].filter((x) => !isD(x));
    const sideColors = lat.map((x) => fl[x]).sort();
    // ¿La esquina muestra el color de la cross hacia D? (esquina de la cross orientada)
    const dFacelet = cornerFacelet[p].find((x) => isD(x))!;
    const cornerOk = fl[dFacelet] === crossColor;
    // ¿La arista del ecuador de ese hueco tiene esos 2 colores y está en posición?
    const [a, b] = edgeFacelet[e];
    const edgePair = [fl[a], fl[b]].sort();
    const edgeOk = edgePair.join("") === sideColors.join("") && t.ep[e] === e && t.eo[e] === 0;
    out.push({ pair: sideColors.join(""), solved: cornerOk && edgeOk });
  }
  return out;
}

/** Nombre CubeRoot de un par de colores (BO, GR, BR, GO…). */
const PAIR_NAME: Record<string, string> = {
  RB: "BR", RF: "FR", RG: "GR", RU: "UR", RD: "DR",
  FB: "BF", FL: "FL", FG: "GF", FU: "UF", FD: "DF",
  BL: "BL", BG: "GB", BU: "UB", BD: "DB",
  LG: "GL", LU: "UL", LD: "DL",
  GU: "UG", GD: "DG",
  UD: "DU",
};

let prevSolved: string[] = [];
for (let i = 0; i < states.length; i++) {
  // Busca la rotación con cross en D
  let best: { pairs: string[]; rot: string } | null = null;
  for (const r of ROTS) {
    const t = r ? states[i].clone() : states[i];
    if (r) t.applySequence(r);
    const fl = FaceletStringConverter.toFaceletString(t).split("");
    if (!crossOnD(t, fl)) continue;
    const slots = dSlots(t, fl);
    const pairs = slots.map((x) => PAIR_NAME[x.pair] ?? x.pair);
    if (best === null) best = { pairs, rot: r };
  }
  const slots = best?.pairs ?? [];
  const solved = best ? (() => {
    const t = best.rot ? states[i].clone() : states[i];
    if (best.rot) t.applySequence(best.rot);
    const fl = FaceletStringConverter.toFaceletString(t).split("");
    const sl = dSlots(t, fl);
    return sl.map((x, k) => (x.solved ? slots[k] : null)).filter(Boolean) as string[];
  })() : [];
  const newly = solved.filter((x) => !prevSolved.includes(x));
  console.log(`Fase ${i} (${PHASES[i].slice(0, 34).padEnd(36)}) rot=${String(best?.rot ?? "NONE").padEnd(9)} huecos=[${slots.join(",")}] resueltos=[${solved.join(",")}] ${newly.length ? `→ NUEVO: ${newly.join(",")}` : ""}`);
  prevSolved = solved;
}
