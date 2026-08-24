/**
 * Cf a fondo:
 * 1) ¿los algs del paste del usuario resuelven el setup quest de Cf?
 * 2) ¿el tail del setup largo es un scramble solo-U (F2L intacto)?
 * 3) ¿qué hace el prefijo de 7 movimientos?
 * 4) todos los rows de Cf con combos auf
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function fullSolved(s: CubeState): boolean {
  return s.isSolved();
}

const src = readFileSync(resolve(QUEST_DIR, "cf.html"), "utf-8");
const setupM = src.match(/selectedSetup:\s*"([^"]+)"/);
const setup = normQuest(setupM![1]);
const moves = setup.split(" ");
const S = new CubeState();
S.applySequence(setup);
console.log("setup Cf:", setup, `(${moves.length} movimientos)`);

// 2) tail (últimos 11) ¿deja F2L resuelto?
const tail = moves.slice(7).join(" ");
const t = new CubeState();
t.applySequence(tail);
console.log(`\ntail [${tail}] (${tail.split(" ").length} mov) → F2L resuelto: ${f2lSolved(t)} | cubo resuelto: ${fullSolved(t)}`);

// prefijo (primeros 7)
const head = moves.slice(0, 7).join(" ");
const h = new CubeState();
h.applySequence(head);
console.log(`head [${head}] (${head.split(" ").length} mov) → F2L resuelto: ${f2lSolved(h)}`);

// 3) ¿el tail es un scramble del U-layer? comparar estado F2L tras setup completo vs tras head
console.log(`\nF2L tras head:  cp[4..7]=${[h.cp[4], h.cp[5], h.cp[6], h.cp[7]]} ep[8..11]=${[h.ep[8], h.ep[9], h.ep[10], h.ep[11]]}`);
console.log(`F2L tras full:  cp[4..7]=${[S.cp[4], S.cp[5], S.cp[6], S.cp[7]]} ep[8..11]=${[S.ep[8], S.ep[9], S.ep[10], S.ep[11]]}`);
console.log(`U  tras head:  cp[0..3]=${[h.cp[0], h.cp[1], h.cp[2], h.cp[3]]} ep[0..3]=${[h.ep[0], h.ep[1], h.ep[2], h.ep[3]]}`);
console.log(`U  tras full:  cp[0..3]=${[S.cp[0], S.cp[1], S.cp[2], S.cp[3]]} ep[0..3]=${[S.ep[0], S.ep[1], S.ep[2], S.ep[3]]}`);

// 1) algs del paste del usuario
const pasteAlgs: [string, string][] = [
  ["paste: R U' R' U (Cn red)", "R U' R' U"],
  ["paste: L' U L (Li red)", "L' U L"],
  ["paste: L F' L2 U L U2 F", "L F' L2 U L U2 F"],
  ["paste: U L' U' L (Gi red)", "U L' U' L"],
  ["paste: L F' L' F (Ma red)", "L F' L' F"],
  ["paste: L' U' L (Ca red)", "L' U' L"],
  ["paste: U L' U L (Jm red)", "U L' U L"],
  ["paste: U2 F' L F L' (Je red)", "U2 F' L F L'"],
  ["paste: r U' r' F (Ma red)", "r U' r' F"],
];
console.log("\n=== algs del paste contra setup quest Cf ===");
for (const [label, alg] of pasteAlgs) {
  const tt = S.clone();
  tt.applySequence(alg);
  console.log(`  ${label.padEnd(40)} → F2L: ${f2lSolved(tt) ? "✅" : "❌"} full: ${fullSolved(tt) ? "✅" : "❌"}`);
}

// 4) todos los rows con combos
console.log("\n=== rows de Cf: busca cualquier combo que resuelva ===");
const rows = [...src.matchAll(/\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)"/g)];
let found = 0;
for (const r of rows) {
  const alg = normQuest(r[1]);
  const auf = normQuest(r[3]);
  const combos = [alg, `${alg} ${auf}`.trim(), `${auf} ${alg}`.trim()];
  for (const combo of combos) {
    const tt = S.clone();
    try { tt.applySequence(combo); } catch { continue; }
    if (f2lSolved(tt)) {
      console.log(`  ✅ ${r[2] || "(sin id)"} | alg="${r[1]}" auf="${r[3]}" combo="${combo}"`);
      found++;
      break;
    }
  }
}
console.log(`  total solves encontrados: ${found}/${rows.length}`);
