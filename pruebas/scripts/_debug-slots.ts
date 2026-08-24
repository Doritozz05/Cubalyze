/** Depuración: slots por fase en el frame crudo (cross blanca en D). */
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

// Estado tras cada fase
const states: CubeState[] = [];
const s = new CubeState();
s.applySequence(SCRAMBLE);
for (const ph of PHASES) {
  for (const t of tokenize(ph)) s.applySequence(t);
  states.push(s.clone());
}

const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const cornerColor: string[][] = [
  ["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"],
];
const edgeColor: string[][] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
  ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];

// El frame del solver: cross BLANCA en D. Las piezas blancas son 0-3 (esquinas)
// y las aristas blancas 0-3. Slots del solver (esquina blanca + arista de color):
//   FR: esquina 0 + arista 8 · FL: esquina 1 + arista 9 · BL: esquina 2 + arista 10 · BR: esquina 3 + arista 11
// PERO el frame crudo puede estar rotado. Comprobamos por COLOR: la cross está en
// D con color blanco; los centros laterales (que no existen en el modelo) los
// inferimos de la cross: la arista blanca-roja en DF muestra rojo en F, etc.

function findSolverFrame(state: CubeState): { rot: string; st: CubeState } | null {
  const fullSig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}`;
  const ROTS = [""];
  // generamos las 24
  const seen = new Set<string>([fullSig(new CubeState())]);
  const queue: { seq: string; key: string }[] = [{ seq: "", key: fullSig(new CubeState()) }];
  const all: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    all.push(cur.seq);
    for (const m of ["x", "y", "z"]) {
      const seq = (cur.seq + " " + m).trim();
      const c = new CubeState();
      c.applySequence(seq);
      const k = fullSig(c);
      if (!seen.has(k)) { seen.add(k); queue.push({ seq, key: k }); }
    }
  }
  for (const r of all) {
    const t = r ? state.clone() : state;
    if (r) t.applySequence(r);
    // cross blanca en D: posiciones 4-7 tienen piezas 0-3 (aristas blancas) con eo=0
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const d = ep.slice(4, 8);
    if (new Set(d).size === 4 && d.every((p) => p <= 3) && eo.slice(4, 8).every((o) => o === 0)) {
      return { rot: r, st: t };
    }
  }
  return null;
}

// Slots completos en un frame con cross blanca en D: esquina blanca c en posición
// de casa + arista en casa. En este frame normalizado, la esquina blanca que
// pertenece al slot X está en la posición de casa de ese slot (4-7) con co=0, y
// la arista del par (8-11) en su posición con eo=0.
// En el frame con cross BLANCA en D: las esquinas de la capa D son las piezas
// blancas 0-3 (cp), y la esquina del slot FR es la blanca con laterales {F,R}
// = pieza 0 (URF); la arista del slot FR es la 8 (FR) en posición 8, etc.
const SLOT_PIECES = [
  { name: "FR", c: 0, cPos: 4, e: 8, ePos: 8 },
  { name: "FL", c: 1, cPos: 5, e: 9, ePos: 9 },
  { name: "BL", c: 2, cPos: 6, e: 10, ePos: 10 },
  { name: "BR", c: 3, cPos: 7, e: 11, ePos: 11 },
];
function slotsInFrame(t: CubeState): string[] {
  const cp = Array.from(t.cp);
  const co = Array.from(t.co);
  const ep = Array.from(t.ep);
  const eo = Array.from(t.eo);
  const out: string[] = [];
  for (const { name, c, cPos, e, ePos } of SLOT_PIECES) {
    if (cp[cPos] === c && co[cPos] === 0 && ep[ePos] === e && eo[ePos] === 0) {
      out.push(name);
    }
  }
  return out;
}

console.log("Frame por fase (rotación que pone cross blanca en D):");
for (let i = 0; i < states.length; i++) {
  const fr = findSolverFrame(states[i]);
  const fl = fr ? FaceletStringConverter.toFaceletString(fr.st) : "?";
  console.log(`\nFase ${i} (${PHASES[i]})`);
  console.log(`  rot=${fr?.rot ?? "NONE"} slots=${fr ? slotsInFrame(fr.st).join(",") : "?"}`);
  console.log(`  fl=${fl}`);
}
