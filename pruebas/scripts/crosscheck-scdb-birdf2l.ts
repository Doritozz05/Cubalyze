/**
 * Cruce SCDB seed <-> BirdF2L.
 *
 * El match por texto crudo es ~9% porque SCDB escribe los algs con rotaciones
 * delante (y' R' U' R) en un marco distinto al de BirdF2L (que asume el caso
 * pre-rotado). Son el MISMO alg escrito diferente.
 *
 * Aqui medimos dos niveles:
 *   1) texto crudo
 *   2) texto con rotaciones iniciales/finales quitadas (y/y'/y2/x/x'/x2/z/z'/z2)
 * Uso: pnpm dlx tsx scripts/crosscheck-scdb-birdf2l.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

const ROTS = new Set(["y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2"]);

function stripRotations(tokens: string[]): string {
  const t = [...tokens];
  while (t.length && ROTS.has(t[0])) t.shift();
  while (t.length && ROTS.has(t[t.length - 1])) t.pop();
  return t.join(" ");
}

// Pool de BirdF2L (texto crudo)
const pool = new Set<string>();
for (const p of Object.values(data) as any[]) {
  for (const a of p.algs) pool.add(a.moves);
}

let total = 0, rawHit = 0, rotHit = 0;
const fr = { total: 0, raw: 0, rot: 0 };

for (const fc of ALL_F2L_CASES) {
  for (const a of fc.algorithms) {
    const moves = a.moves as string[];
    total++;
    const raw = moves.join(" ");
    const stripped = stripRotations(moves);
    const slot = (a.notes ?? "").match(/Slot: (\w+)/)?.[1] ?? "?";
    if (slot === "FR") fr.total++;
    if (pool.has(raw)) {
      rawHit++;
      if (slot === "FR") fr.raw++;
    }
    if (stripped && pool.has(stripped)) {
      rotHit++;
      if (slot === "FR") fr.rot++;
    }
  }
}

console.log(`=== CRUCE SCDB seed (${total} algs) -> BirdF2L ===`);
console.log(`texto crudo:                    ${rawHit} (${((100 * rawHit) / total).toFixed(1)}%)`);
console.log(`texto sin rotaciones iniciales: ${rotHit} (${((100 * rotHit) / total).toFixed(1)}%)`);
console.log(`\nSolo slot FR (${fr.total} algs):`);
console.log(`  crudo:      ${fr.raw} (${((100 * fr.raw) / fr.total).toFixed(1)}%)`);
console.log(`  sin rotac.: ${fr.rot} (${((100 * fr.rot) / fr.total).toFixed(1)}%)`);
