/**
 * Búsqueda exhaustiva para Cf:
 * 1) Estado completo tras el alg directo de quest (L F' L2 U L U2 F).
 * 2) Rotar el setup por las 24 orientaciones y probar los algs directos.
 * 3) AUF antes/después.
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
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];

const src = readFileSync(resolve(QUEST_DIR, "cf.html"), "utf-8");
const setup = normQuest(src.match(/selectedSetup:\s*"([^"]+)"/)![1]);
const S = new CubeState();
S.applySequence(setup);
console.log("setup Cf:", setup);

// 1) estado completo tras el alg directo
const alg = "L F' L2 U L U2 F";
const t = S.clone();
t.applySequence(alg);
console.log(`\ntras "${alg}": F2L: ${f2lSolved(t) ? "✅" : "❌"}`);
console.log(`  cp: ${[...t.cp].join(",")}`);
console.log(`  co: ${[...t.co].join(",")}`);
console.log(`  ep: ${[...t.ep].join(",")}`);
console.log(`  eo: ${[...t.eo].join(",")}`);

// 2) buscar algs directos que resuelvan el setup en alguna rotacion
const directRows = [...src.matchAll(/\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)"/g)];
console.log("\n=== algs directos × rotaciones del setup ===");
let anyFound = false;
for (const r of directRows.slice(0, 10)) {
  const a = normQuest(r[1]);
  const auf = normQuest(r[3]);
  for (const rot of ROTS) {
    const rs = S.clone();
    try { rs.applySequence(rot); } catch { continue; }
    const combos = [a, `${a} ${auf}`.trim(), `${auf} ${a}`.trim()];
    for (const combo of combos) {
      const tt = rs.clone();
      try { tt.applySequence(combo); } catch { continue; }
      if (f2lSolved(tt)) {
        console.log(`  ✅ rot="${rot || "-"}" alg="${r[1]}" auf="${r[3]}" combo="${combo}"`);
        anyFound = true;
        break;
      }
    }
    if (anyFound) break;
  }
  if (anyFound) break;
}
if (!anyFound) console.log("  NINGUNA combinación resuelve (rotaciones × algs directos).");

// 3) el inverso del setup ¿es un alg conocido de quest? (debería resolver)
const INV: Record<string, string> = { U: "U'", "U'": "U", U2: "U2", R: "R'", "R'": "R", R2: "R2", F: "F'", "F'": "F", F2: "F2", D: "D'", "D'": "D", D2: "D2", L: "L'", "L'": "L", L2: "L2", B: "B'", "B'": "B", B2: "B2", M: "M'", "M'": "M", M2: "M2", E: "E'", "E'": "E", E2: "E2", S: "S'", "S'": "S", S2: "S2", x: "x'", "x'": "x", x2: "x2", y: "y'", "y'": "y", y2: "y2", z: "z'", "z'": "z", z2: "z2" };
const inv = setup.split(" ").reverse().map((m) => INV[m] ?? m).join(" ");
console.log(`\ninverso del setup: ${inv}`);
const invT = S.clone();
invT.applySequence(inv);
console.log(`  setup + inverso → F2L: ${f2lSolved(invT) ? "✅" : "❌"}`);
