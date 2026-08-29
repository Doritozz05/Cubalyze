/**
 * _scan-insp-bug.cjs — measure the inspection-rotation display bug.
 *
 * Bug (reported on cuberoot-2542): inspection rotations (z2 y') don't show in
 * the "Orientation" row of OurDetectionPanel and instead get interleaved into
 * the Cross row. Root cause: `recon.inspection` ends up empty (the embedded
 * "// insp" phase label doesn't match /inspect/i) while recon.rotations still
 * carries the grip rotations at moveIndex 0 — the panel can't tell them apart.
 *
 * This scan counts, over every CFOP 3×3 record:
 *   - solves with leading rotations (moveIndex 0) in the reconstruction;
 *   - of those, how many have recon.inspection EMPTY (the display bug);
 *   - labels of the baked first phase (rotations-only) that fail to match.
 *
 * IMPORTANT: requires a FRESH build of analysis-engine (the dist is what
 * this script measures): `pnpm --filter @cubeforge/analysis-engine build`.
 */
const fs = require("fs");
const path = require("path");
const {
  analyzeSolveText,
} = require("../packages/analysis-engine/dist/index.js");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "apps/web/public/recon-data");
const idx = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));

const ROT_RE = /^[xyz][2']?$/;

function countRotationTokens(s) {
  if (!s) return 0;
  return s.split(/\s+/).filter((t) => ROT_RE.test(t)).length;
}

let cfop3 = 0;
let analyzed = 0;
let analysisFailures = 0;
let withLeadingRots = 0;
let bug = 0; // leading rotations but recon.inspection has no rotations
let labelMiss = new Map(); // first-phase label -> count (rotations-only phase)
let labeledInspOk = 0;
let unlabeled = 0; // leading rots, no rotations-only first phase (inline case)

const t0 = Date.now();
for (let c = 0; c * idx.chunkSize < idx.count; c++) {
  const file = path.join(
    DIR,
    "data",
    "chunk-" + String(c).padStart(3, "0") + ".json",
  );
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const s of data.solves) {
    if (s.methodGroup !== "CFOP" || s.puzzle !== "3x3") continue;
    cfop3++;
    let res;
    try {
      res = analyzeSolveText({
        setup: s.scramble,
        inspection: s.recognition?.inspection || undefined,
        solution: s.text,
        method: "CFOP",
      });
    } catch {
      analysisFailures++;
      continue;
    }
    analyzed++;
    const recon = res.reconstruction;
    const leadingRots = recon.rotations.filter((r) => r.moveIndex === 0);
    if (leadingRots.length === 0) continue;
    withLeadingRots++;
    const inspRotCount = countRotationTokens(recon.inspection);
    if (inspRotCount === 0) {
      bug++;
      // Which label did the baked first phase carry?
      const first = s.phases && s.phases[0];
      const firstIsRotationsOnly =
        first && first.moves && first.moves.trim().split(/\s+/).every((t) => ROT_RE.test(t));
      if (firstIsRotationsOnly) {
        labelMiss.set(first.label || "(empty)", (labelMiss.get(first.label || "(empty)") || 0) + 1);
      } else {
        unlabeled++;
      }
    }
  }
}
const dt = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`CFOP 3×3 records            : ${cfop3}`);
console.log(`analyzed                    : ${analyzed} (${((analyzed / cfop3) * 100).toFixed(1)}%)`);
console.log(`analysis failures           : ${analysisFailures}`);
console.log(`with leading rotations (m0) : ${withLeadingRots} (${((withLeadingRots / Math.max(1, analyzed)) * 100).toFixed(1)}% of analyzed)`);
console.log(`BUG (leading rots, empty inspection): ${bug} (${((bug / Math.max(1, withLeadingRots)) * 100).toFixed(1)}% of those with leading rots, ${((bug / Math.max(1, analyzed)) * 100).toFixed(1)}% of analyzed)`);
console.log(`  └ rotations-only first phase label miss: ${bug - unlabeled} | inline (no separate phase): ${unlabeled}`);
console.log(`labels of missed rotation-only first phases: ${JSON.stringify(Object.fromEntries(labelMiss))}`);
console.log(`NOTE: residual "inline" cases (${unlabeled}) are BY DESIGN — rotations written inline in the first face phase (no separate inspection phase); the Steps table shows them identically, so it is not a divergence.`);
console.log(`time: ${dt}s`);
