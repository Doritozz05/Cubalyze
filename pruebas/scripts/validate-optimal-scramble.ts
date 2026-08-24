/**
 * Temporary validation — does the optimalScramble fallback actually work?
 *
 * For every CubeRoot raw HTML record where `wcaScramble` is missing but
 * `optimalScramble` exists, run analyzeSolveText (the same CFOP pipeline the
 * web uses) with scramble=optimalScramble and the record's solution text, and
 * report how many end solved. This decides whether the fallback in
 * build-recon-web-data.ts is sound before shipping it.
 */
import { analyzeSolveText } from "../../packages/analysis-engine/src/index";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, "../raw/cuberoot-recon");

interface RawSolve {
  id: number;
  event?: string;
  wcaScramble?: string;
  optimalScramble?: string;
  solution?: string;
}

function extractSolve(html: string): RawSolve {
  const i = html.indexOf("initialSolve");
  const j = html.indexOf("initialSameScramble", i);
  if (i === -1 || j === -1) throw new Error("markers not found");
  const seg = html.slice(i, j);
  const open = seg.indexOf("{");
  const close = seg.lastIndexOf("}");
  const content = seg.slice(open, close + 1);
  const inner = JSON.parse('"' + content + '"');
  return JSON.parse(inner);
}

let total = 0;
let hasSolution = 0;
let solved = 0;
let notSolved = 0;
let errors = 0;
const examples: { key: string; solved: boolean; warn?: string[] }[] = [];

for (const f of fs.readdirSync(RAW_DIR).filter((x) => x.endsWith(".html")).sort()) {
  let obj: RawSolve;
  try {
    obj = extractSolve(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
  } catch {
    continue;
  }
  const w = (obj.wcaScramble ?? "").trim();
  const o = (obj.optimalScramble ?? "").trim();
  if (w || !o) continue; // only the fallback population: wcaScramble missing, optimal present
  total++;
  const solution = (obj.solution ?? "").trim();
  if (!solution) continue;
  hasSolution++;
  try {
    const { reconstruction } = analyzeSolveText({
      setup: o,
      inspection: undefined,
      solution,
      method: "CFOP",
    });
    if (reconstruction.finalSolved) {
      solved++;
      if (examples.length < 10) examples.push({ key: `cuberoot-${obj.id}`, solved: true });
    } else {
      notSolved++;
      if (examples.length < 10) {
        examples.push({ key: `cuberoot-${obj.id}`, solved: false, warn: reconstruction.warnings });
      }
    }
  } catch (e) {
    errors++;
  }
}

console.log("opt-only population:", total);
console.log("  with solution text:", hasSolution);
console.log("  finalSolved=true  :", solved);
console.log("  finalSolved=false :", notSolved);
console.log("  engine errors     :", errors);
console.log("--- examples ---");
for (const ex of examples) console.log(" ", JSON.stringify(ex));
