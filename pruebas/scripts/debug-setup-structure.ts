/**
 * Estructura del setup avanzado de quest (Cf) + por qué birdf2l eligió el top alg.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function dump(label: string, s: CubeState) {
  console.log(`  ${label}`);
  console.log(`    cp: ${[...s.cp].join(",")}`);
  console.log(`    co: ${[...s.co].join(",")}`);
  console.log(`    ep: ${[...s.ep].join(",")}`);
  console.log(`    eo: ${[...s.eo].join(",")}`);
}

const src = readFileSync(resolve(__dirname, "../raw/quest/study/cf.html"), "utf-8");
const setup = normQuest(src.match(/selectedSetup:\s*"([^"]+)"/)![1]);
const moves = setup.split(" ");

console.log("═══ Cf: setup completo =", setup);
console.log("═══ descomposición ═══");
const head = moves.slice(0, 7).join(" ");
const tail = moves.slice(7).join(" ");
console.log("head (7):", head);
console.log("tail (10):", tail);

console.log("\n--- estado tras head ---");
dump("", stateOf(head));
console.log("--- estado tras head+tail (setup completo) ---");
dump("", stateOf(setup));
console.log("--- tail aplicado a cubo resuelto ---");
dump("", stateOf(tail));

// ¿la cola es un corner twist de la capa U? probar: tras head, aplicar la cola en partes
console.log("\n═══ head + [L2] + [U2 F' U2 F U2 B' U2 B] + [L2] ═══");
const t1 = stateOf(`${head} L2`);
dump("head+L2", t1);
const t2 = stateOf(`${head} L2 U2 F' U2 F U2 B' U2 B`);
dump("head+L2+twist", t2);
const t3 = stateOf(setup);
dump("head+L2+twist+L2 (=setup)", t3);

// birdf2l: top alg de Cf (parsed.json)
const parsed = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const cf = parsed["Cf"];
console.log("\n═══ birdf2l parsed.json: Cf ═══");
console.log("  algs:", cf?.algs?.length);
const sorted = [...(cf?.algs ?? [])].sort((a: any, b: any) => (a.speed ?? 1e9) - (b.speed ?? 1e9));
for (const a of sorted.slice(0, 5)) {
  console.log(`  top: ${JSON.stringify(a)}`);
}
