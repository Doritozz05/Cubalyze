import { tokenize, isRotation } from "../../packages/math-core/src/notation/moveNotation";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(ROOT, "apps/web/public/reconstructions/data");

function stmOf(text: string): number {
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const movesPart = t.split("//")[0] ?? "";
    total += tokenize(movesPart, { expandWide: false }).filter((x) => !isRotation(x)).length;
  }
  return total;
}

let total = 0, withStm = 0, match = 0, diffs: [string, number, number][] = [];
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const { solves } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
  for (const s of solves) {
    if (s.puzzle !== "3x3") continue;
    total++;
    if (s.stm == null) continue;
    withStm++;
    const mine = stmOf(s.text ?? "");
    if (mine === s.stm) match++;
    else if (diffs.length < 8) diffs.push([s.key, s.stm, mine]);
  }
}
console.log(JSON.stringify({ total, withStm, match, mismatch: withStm - match, pct: ((match / withStm) * 100).toFixed(1) }, null, 1));
console.log("sample diffs [key, bakedStm, mine]:", diffs);
