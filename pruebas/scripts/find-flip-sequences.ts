/**
 * Busca secuencias F_p (cortas) tales que F_p aplicada a un estado con F2L
 * resuelto: mantiene todas las piezas F2L en su posición y orientación,
 * EXCEPTO la arista en la posición p (8..11) que queda volteada.
 *
 * Objetivo de búsqueda (desde resuelto): cp[4..7]=4..7 co=0, ep[8..11]=8..11,
 * eo[p]=1, resto eo=0. Capa U libre.
 */
import { CubeState } from "../../packages/math-core/src/index";

const FACES = ["U", "R", "F", "D", "L", "B"];
const MOVES: string[] = [];
for (const f of FACES) for (const t of ["", "'", "2"]) MOVES.push(f + t);
const baseOf = (m: string) => m[0];

function hTarget(s: CubeState, p: number): number {
  let h = 0;
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) h++;
  for (let i = 8; i <= 11; i++) {
    if (s.ep[i] !== i) h += 2;
    else if (s.eo[i] !== (i === p ? 1 : 0)) h++;
  }
  return h;
}
function isTarget(s: CubeState, p: number): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== (i === p ? 1 : 0)) return false;
  return true;
}
function fullKey(s: CubeState): string {
  let k = "";
  for (let i = 0; i < 8; i++) k += `${s.cp[i]}:${s.co[i]},`;
  for (let i = 0; i < 12; i++) k += `${s.ep[i]}:${s.eo[i]},`;
  return k;
}

let nodes = 0;
function dfs(s: CubeState, p: number, g: number, threshold: number, prevFace: string, path: string[], trans: Set<string>): string[] | null {
  nodes++;
  const h = hTarget(s, p);
  if (h === 0) return path.slice();
  if (g + Math.ceil(h / 2) > threshold) return null;
  for (const mv of MOVES) {
    if (baseOf(mv) === prevFace) continue;
    const ns = s.clone();
    ns.applySequence(mv);
    const key = fullKey(ns);
    if (trans.has(key)) continue;
    trans.add(key);
    path.push(mv);
    const res = dfs(ns, p, g + 1, threshold, baseOf(mv), path, trans);
    path.pop();
    if (res) return res;
  }
  return null;
}
function solveFlip(p: number): string[] | null {
  const s0 = new CubeState();
  const h0 = hTarget(s0, p);
  for (let th = Math.ceil(h0 / 2); th <= 16; th += 2) {
    nodes = 0;
    const trans = new Set<string>([fullKey(s0)]);
    const res = dfs(s0, p, 0, th, "", [], trans);
    if (res) return res;
  }
  return null;
}

for (const p of [8, 9, 10, 11]) {
  const t0 = Date.now();
  const F = solveFlip(p);
  const ms = Date.now() - t0;
  if (!F) { console.log(`E${p}: NO encontrado (${ms}ms)`); continue; }
  // verificar
  const s = new CubeState();
  s.applySequence(F.join(" "));
  const ok = isTarget(s, p);
  console.log(`E${p}: ${F.join(" ")} (${F.length} mov, ${ms}ms, ${nodes} nodos) → ok: ${ok}`);
}
