/**
 * Clasifica las filas de quest que no resuelven FR directo:
 *  - ¿transforman Jb en otro caso F2L valido (reduccion/slot-swap)?
 *  - ¿resuelven en un marco rotado si el caso está rotado?
 * Uso: pnpm dlx tsx pruebas/scripts/debug-quest-nosolver.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8")) as Record<string, { algs: { moves: string }[] }>;
const QUEST = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/jb-data.json"), "utf-8")) as any;

function invertSequence(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.endsWith("'")) out.push(t.slice(0, -1));
    else if (t.endsWith("2")) out.push(t);
    else out.push(t + "'");
  }
  return out.join(" ");
}
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
/** caso F2L valido: posiciones no-FR solo piezas F2L + par reconocible */
function validCase(s: CubeState): string {
  for (const i of [5, 6, 7]) if (s.cp[i] < 4 || s.cp[i] > 7) return "INVALIDO(corner LL en F2L)";
  for (const i of [9, 10, 11]) if (s.ep[i] < 8 || s.ep[i] > 11) return "INVALIDO(edge LL en F2L)";
  for (const i of [4, 5, 6, 7]) if (s.ep[i] < 4 || s.ep[i] > 7) return "INVALIDO(edge LL en cross)";
  return `caso valido, par en ${pairPos(s)}`;
}

// S_Jb canonico
const tally = new Map<string, { n: number; state: CubeState }>();
for (const a of PARSED["Jb"].algs) {
  const s = new CubeState();
  try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
  const k = pairPos(s);
  const t = tally.get(k);
  if (t) t.n++; else tally.set(k, { n: 1, state: s });
}
let bestN = 0; let JbS: CubeState | null = null;
for (const t of tally.values()) if (t.n > bestN) { bestN = t.n; JbS = t.state; }

// filas no-solver de quest (según el reporte: marcos rotados incluidos)
const rows = QUEST.rows.a as any[];
let n = 0;
for (const r of rows) {
  const full = (r.auf ? r.auf + " " : "") + r.alg;
  let solvedAnywhere = false;
  for (const rot of ["", "y", "y2", "y'"]) {
    const st = JbS!.clone();
    try {
      if (rot) st.applySequence(rot);
      st.applySequence(full);
    } catch { continue; }
    if (f2lSolved(st)) { solvedAnywhere = true; break; }
  }
  if (solvedAnywhere) continue;
  // no resuelve en ningun marco: ¿que hace con el caso?
  const st = JbS!.clone();
  try { st.applySequence(full); } catch { continue; }
  n++;
  const vc = validCase(st);
  console.log(`${full.padEnd(30)} ${vc} reduces=${JSON.stringify(r.reduces ?? []).slice(0, 60)}`);
}
console.log(`\nno-solvers: ${n}`);
