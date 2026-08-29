import { tokenize } from "../../packages/math-core/src/notation/moveNotation.js";
import { OrientationTable } from "../../packages/math-core/src/orientation/OrientationTable.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(ROOT, "apps/web/public/recon-data/data");
function displayRotationEntry(dt: string): boolean {
  const norm = dt.length >= 3 && dt.endsWith("'") && dt[dt.length - 2] === "2" ? dt.slice(0, -1) : dt;
  return OrientationTable.rotationEntryFor(norm) != null;
}
// Force the stm==null derivation branch: compute phases-based count, compare to baked STM
let total = 0, match = 0, diffs: [string, number, number][] = [];
for (const f of fs.readdirSync(DATA_DIR).filter((x: string) => x.endsWith(".json"))) {
  const { solves } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
  for (const r of solves) {
    if (r.puzzle !== "3x3" || r.stm == null || !Array.isArray(r.phases)) continue;
    let stm = 0;
    for (const p of r.phases) {
      if (!p || typeof p.moves !== "string") continue;
      for (const t of tokenize(p.moves, { expandWide: false })) {
        if (!displayRotationEntry(t)) stm++;
      }
    }
    total++;
    if (stm === r.stm) match++; else if (diffs.length < 5) diffs.push([r.key, stm, r.stm]);
    if (total >= 300) break;
  }
  if (total >= 300) break;
}
console.log(JSON.stringify({ checked: total, match, pct: ((match / total) * 100).toFixed(1), diffs }, null, 1));
