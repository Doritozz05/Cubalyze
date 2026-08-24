/** Depuración detallada fase 2: estado normalizado (cross blanca en D, arista
 * blanca-roja en DR) y las condiciones de cada slot, paso a paso. */
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
const SOLVE = [
  "z y",
  "D2 L U R' U'",
  "x' D' L' U L U' L' U L D",
];

const states: CubeState[] = [];
const s = new CubeState();
s.applySequence(SCRAMBLE);
for (const ph of SOLVE) {
  for (const t of tokenize(ph)) s.applySequence(t);
  states.push(s.clone());
}
const st = states[states.length - 1]; // tras F2L 1

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

const cornerColor: string[][] = [
  ["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"],
];
const edgeColor: string[][] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"],
  ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];

// Cross blanca en D con ancla (blanca-roja en DR) en ALGÚN frame
function findNormalized(state: CubeState): { st: CubeState; rot: string } | null {
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

console.log("Estado tras F2L 1 (raw):", FaceletStringConverter.toFaceletString(st));
const norm = findNormalized(st);
if (!norm) {
  console.log("NO se pudo normalizar con ancla blanca-roja en DR");
  // Buscar cualquier frame con 4 aristas blancas en D
  for (const r of ROTS) {
    const t = r ? st.clone() : st;
    if (r) t.applySequence(r);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const d = ep.slice(4, 8);
    if (new Set(d).size === 4 && d.every((p) => p <= 3) && eo.slice(4, 8).every((o) => o === 0)) {
      console.log(`  frame con 4 blancas en D: rot=${r} ep[4..7]=${d} (ep[4]=${ep[4]})`);
      // qué arista blanca está en DR → el ancla correcta es otra pieza
      break;
    }
  }
  process.exit(0);
}
const t = norm.st;
console.log(`Frame normalizado (rot=${norm.rot}):`);
console.log(`  cp: ${Array.from(t.cp)}`);
console.log(`  co: ${Array.from(t.co)}`);
console.log(`  ep: ${Array.from(t.ep)}`);
console.log(`  eo: ${Array.from(t.eo)}`);
console.log(`  D-edges (4-7): ${Array.from(t.ep).slice(4, 8)} eo=${Array.from(t.eo).slice(4, 8)}`);
console.log(`  M-edges (8-11): ${Array.from(t.ep).slice(8, 12)} eo=${Array.from(t.eo).slice(8, 12)}`);
console.log(`  D-corners (4-7): ${Array.from(t.cp).slice(4, 8)} co=${Array.from(t.co).slice(4, 8)}`);

const SLOT_PIECES = [
  { name: "FR", c: 0, cPos: 4, e: 8, ePos: 8 },
  { name: "FL", c: 1, cPos: 5, e: 9, ePos: 9 },
  { name: "BL", c: 2, cPos: 6, e: 10, ePos: 10 },
  { name: "BR", c: 3, cPos: 7, e: 11, ePos: 11 },
];
console.log("\nSlots:");
for (const { name, c, cPos, e, ePos } of SLOT_PIECES) {
  const corner = t.cp[cPos];
  const edge = t.ep[ePos];
  const cOk = corner === c && t.co[cPos] === 0;
  const eOk = edge === e && t.eo[ePos] === 0;
  console.log(`  ${name}: esquina pos${cPos}=pieza${corner} (${cornerColor[corner].join("")}) co=${t.co[cPos]} ${cOk ? "✓" : "✗"} | arista pos${ePos}=pieza${edge} (${edgeColor[edge].join("")}) eo=${t.eo[ePos]} ${eOk ? "✓" : "✗"} → ${cOk && eOk ? "RESUELTO" : ""}`);
}
