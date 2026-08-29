/**
 * End-to-end verification of the derived stat chips (STM / TPS / Cross STM /
 * F2L / LL / Rotations) against the real dataset — replicates the exact logic
 * added to `apps/web/src/views/Reconstructions/reconData.ts` (deriveReconStats)
 * using the built `@cubeforge/analysis-engine` dist (which contains the `2'`
 * fix). Shows "before" (baked crawl data) vs "after" (derived).
 */
import { analyzeSolveText } from "../../packages/analysis-engine/dist/index.js";
import { tokenize } from "../../packages/math-core/src/notation/moveNotation.js";
import { OrientationTable } from "../../packages/math-core/src/orientation/OrientationTable.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(ROOT, "apps/web/public/recon-data/data");
const ROT_TEST = /^[xyz][2']?$/;

function displayRotationEntry(dt: string): boolean {
  const norm =
    dt.length >= 3 && dt.endsWith("'") && dt[dt.length - 2] === "2"
      ? dt.slice(0, -1)
      : dt;
  return OrientationTable.rotationEntryFor(norm) != null;
}

// ── Load all 3x3 CFOP records ────────────────────────────────────────────────
const records: any[] = [];
for (const f of fs.readdirSync(DATA_DIR).filter((x: string) => x.endsWith(".json"))) {
  const { solves } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
  for (const s of solves) {
    if (s.puzzle === "3x3" && s.methodGroup === "CFOP" && s.text) records.push(s);
  }
}
console.log(`3x3 CFOP records with text: ${records.length}`);

// ── Before: baked crawl fields ───────────────────────────────────────────────
const before = {
  stmNull: 0, tpsNull: 0, crossStmNull: 0, f2lNull: 0, llNull: 0, allNull: 0,
};
let allNullExamples: string[] = [];
for (const r of records) {
  const st = r.stats || {};
  if (r.stm == null) before.stmNull++;
  if (r.tps == null) before.tpsNull++;
  if (st.crossStm == null) before.crossStmNull++;
  if (st.f2l == null) before.f2lNull++;
  if (st.ll == null) before.llNull++;
  if (r.stm == null && r.tps == null && st.crossStm == null && st.f2l == null && st.ll == null) {
    before.allNull++;
    if (allNullExamples.length < 3) allNullExamples.push(r.key);
  }
}
console.log("\n— BEFORE (baked crawl data) —");
console.log(JSON.stringify(before, null, 1));
console.log("examples fully empty:", allNullExamples);

// ── After: replicate deriveReconStats ────────────────────────────────────────
const after = { allFilled: 0, stmDerived: 0, tpsDerived: 0, phaseDerived: 0, failed: 0 };
const examples: any[] = [];
for (const r of records) {
  const st = r.stats || {};
  const phases = r.phases || [];
  if (r.stm == null) {
    let stm = 0;
    for (const p of phases) {
      for (const t of tokenize(p.moves, { expandWide: false })) {
        if (!displayRotationEntry(t)) stm++;
      }
    }
    r.stm = stm;
    after.stmDerived++;
  }
  if (r.tps == null && r.stm != null && r.time > 0) {
    r.tps = r.stm / r.time;
    after.tpsDerived++;
  }
  let result: any = null;
  try {
    result = analyzeSolveText({
      setup: r.scramble,
      inspection: r.recognition?.inspection || undefined,
      solution: r.text,
      method: "CFOP",
      totalTimeMs: r.time > 0 ? r.time * 1000 : undefined,
    });
  } catch { result = null; }
  if (!result) { after.failed++; continue; }
  const recon = result.reconstruction;
  const crossStm = recon.cross.moves.length;
  const f2l = recon.pairs.reduce((s: number, p: any) => s + p.moves.length, 0);
  const ll = (recon.oll?.moves.length ?? 0) + (recon.pll?.moves.length ?? 0);
  if (st.crossStm == null || st.f2l == null || st.ll == null) after.phaseDerived++;
  st.crossStm ??= crossStm;
  st.f2l ??= f2l;
  st.ll ??= ll;
  if (
    r.stm != null && r.tps != null &&
    st.crossStm != null && st.f2l != null && st.ll != null
  ) after.allFilled++;
  if (examples.length < 3) {
    examples.push({
      key: r.key, source: r.source, time: r.time,
      stm: r.stm, tps: +r.tps.toFixed(2),
      crossStm: st.crossStm, f2l: st.f2l, ll: st.ll,
      rotations: r.rotationCount ?? "(always computed in normalizeReconMoves)",
    });
  }
}
const pct = ((after.allFilled / records.length) * 100).toFixed(1);
console.log("\n— AFTER (derived) —");
console.log(JSON.stringify(after, null, 1));
console.log(`\n✅ Chips completely filled: ${after.allFilled}/${records.length} (${pct}%)`);
console.log("\nExamples (reconz records that were empty before):");
console.log(JSON.stringify(examples, null, 1));
