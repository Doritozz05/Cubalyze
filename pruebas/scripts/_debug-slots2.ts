/** Depuración slots con ANCLA: normaliza a cross blanca en D con la arista
 * blanca-roja (pieza 0) en DR (posición 4) eo=0, y lee qué slots están completos.
 *
 * En este frame canónico-del-solver, las esquinas blancas de los slots son las
 * piezas 0-3 en posiciones 4-7, y las aristas 8-11 en posiciones 8-11.
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

/** Normaliza: cross blanca (piezas 0-3) en D, arista blanca-roja (pieza 0) en DR (pos 4), eo=0. */
function normalizeWhiteCross(state: CubeState): { st: CubeState; rot: string } | null {
  for (const r of ROTS) {
    const t = r ? state.clone() : state;
    if (r) t.applySequence(r);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const d = ep.slice(4, 8);
    if (ep[4] === 0 && new Set(d).size === 4 && d.every((p) => p <= 3) && eo.slice(4, 8).every((o) => o === 0)) {
      return { st: t, rot: r };
    }
  }
  return null;
}

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
    if (cp[cPos] === c && co[cPos] === 0 && ep[ePos] === e && eo[ePos] === 0) out.push(name);
  }
  return out;
}

console.log("Slots por fase (frame normalizado con ancla blanca-roja en DR):");
let prev: string[] = [];
for (let i = 0; i < states.length; i++) {
  const norm = normalizeWhiteCross(states[i]);
  const slots = norm ? slotsInFrame(norm.st) : [];
  const newly = slots.filter((x) => !prev.includes(x));
  console.log(`Fase ${i} (${PHASES[i].slice(0, 34).padEnd(36)}) rot=${String(norm?.rot ?? "NONE").padEnd(8)} slots=[${slots.join(",")}] ${newly.length ? `→ NUEVO: ${newly.join(",")}` : ""}`);
  prev = slots;
}
