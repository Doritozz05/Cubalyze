/** Slots en el frame del detector (rot=x x y): cross en U con esquema del solver.
 * Leemos pares de color: la esquina del par muestra crossColor + X + Y, la arista
 * del ecuador muestra X+Y. Mapeamos a notación CubeRoot (BO/GR/BR/GO). */
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

// Frame del detector: rot = x x y (aplicado al timeline)
const FRAME = "x x y";
const rotated = states.map((st) => {
  const t = st.clone();
  t.applySequence(FRAME);
  return t;
});

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

// Tras x x y, la cross está en U (el detector dijo crossFace=U). Los 4 huecos de
// la cross son las esquinas de U (posiciones 0-3) con su arista del ecuador.
// Mapeo posición-esquina → arista: URF→FR, UFL→FL, ULB→BL, UBR→BR.
const SLOT_MAP = [
  { cPos: 0, ePos: 8, slot: "FR" },
  { cPos: 1, ePos: 9, slot: "FL" },
  { cPos: 2, ePos: 10, slot: "BL" },
  { cPos: 3, ePos: 11, slot: "BR" },
];

// Colores canónicos de las piezas (para nombrar el par del hueco)
const cornerColor: string[][] = [
  ["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"],
];
const edgeColor: string[][] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
  ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];

const PAIR_NAME: Record<string, string> = {
  "BO": "BL", "GR": "FR", "BR": "BR", "GO": "FL",
  "RB": "BR", "RF": "FR", "RG": "FR", "BL": "BL", "BG": "BL",
  "GL": "FL", "GF": "FL", "BR": "BR", "LR": "BR", "LF": "FL", "LB": "BL",
};

/** En el frame rotado: ¿qué slots (por colores del par) están resueltos? */
function solvedPairs(t: CubeState): string[] {
  const out: string[] = [];
  const fl = FaceletStringConverter.toFaceletString(t).split("");
  for (const { cPos, ePos, slot } of SLOT_MAP) {
    const piece = t.cp[cPos];
    // esquina en su posición de casa (pieza cPos) con orientación 0
    const cHome = t.cp[cPos] === cPos && t.co[cPos] === 0;
    // arista en casa
    const eHome = t.ep[ePos] === ePos && t.eo[ePos] === 0;
    if (cHome && eHome) {
      // par por colores de la pieza de la esquina
      const colors = cornerColor[piece];
      const side = colors.filter((c) => c !== "U" && c !== "D").sort().join("");
      out.push(side);
    }
  }
  return out;
}

let prev: string[] = [];
for (let i = 0; i < rotated.length; i++) {
  const t = rotated[i];
  const solved = solvedPairs(t);
  const newly = solved.filter((x) => !prev.includes(x));
  console.log(`Fase ${i} (${PHASES[i].slice(0, 34).padEnd(36)}) resueltos=[${solved.join(",")}] ${newly.length ? `→ NUEVO: ${newly.join(",")}` : ""}`);
  prev = solved;
}
