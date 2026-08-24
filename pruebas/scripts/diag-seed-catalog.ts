import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getSeedData } from "../../packages/algorithm-db/src/seed/index";

const GEN_ROOT = resolve(__dirname, "../generated");
const REPORT_PATH = resolve(GEN_ROOT, "verification-report.json");

interface ReportResult { set: string; caseNumber: string; moves: string; status: string }
interface GeneratedAlg { moves: string[]; isDefault: boolean; votes?: number; notes?: string | null }
interface GeneratedCase { caseDef: { subsetId: string; caseNumber: string; id: string }; algorithms: GeneratedAlg[] }
interface GeneratedFile { set: string; subsetId: string; cases: GeneratedCase[] }

const GENERATED: Record<string, { file: string; set: string }> = {
  pll: { file: "scdb-pll.json", set: "PLL" },
  oll: { file: "scdb-oll.json", set: "OLL" },
  f2l: { file: "scdb-f2l-fused.json", set: "F2L" },
  af2l: { file: "scdb-af2l-fused.json", set: "AdvancedF2L" },
  coll: { file: "scdb-coll.json", set: "COLL" },
  wv: { file: "scdb-wv.json", set: "WV" },
  cls: { file: "scdb-cls.json", set: "CLS" },
  sv: { file: "scdb-sv.json", set: "SV" },
  ell: { file: "scdb-ell.json", set: "ELL" },
  antipll: { file: "scdb-antipll.json", set: "AntiPLL" },
};

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function collapseConsecutive(moves: string[]): string[] {
  const out: string[] = [];
  for (const m of moves) {
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const b1 = prev.replace(/2[']/, "");
      const b2 = m.replace(/2[']/, "");
      const d1 = prev.includes("2");
      const d2 = m.includes("2");
      if (b1 === b2 && !d1 && !d2 && prev.endsWith("'") === m.endsWith("'")) {
        out.pop();
        out.push(`${b1}2`);
        continue;
      }
    }
    out.push(m);
  }
  return out;
}

const VALID_MOVE = /^([RLUDFB]w?|[rludfbMES]|[xyz])(2|'|\u2032)?$/;
const isInvalidAlg = (moves: string[]) => !moves.every((m) => VALID_MOVE.test(m));

const report = loadJson<{ results: ReportResult[] }>(REPORT_PATH);
console.log("report exists:", !!report, "| results:", report?.results.length);
const failKeys = new Set(
  (report?.results ?? [])
    .filter((r) => r.status === "fail")
    .map((r) => `${r.set}|${r.caseNumber}|${r.moves}`),
);
const passKeys = new Set(
  (report?.results ?? [])
    .filter((r) => r.status === "pass")
    .map((r) => `${r.set}|${r.caseNumber}|${r.moves}`),
);
console.log("pass entries:", passKeys.size, "| fail entries:", failKeys.size);

const seed = getSeedData();
const casesByKey = new Map(seed.cases.map((c) => [`${c.subsetId}|${c.caseNumber}`, c]));
const algsByCase = new Map<string, { moves: string; slot: string }[]>();
for (const a of seed.algorithms) {
  const list = algsByCase.get(a.caseId) ?? [];
  const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1] ?? "";
  list.push({ moves: JSON.stringify(collapseConsecutive(a.moves)), slot });
  algsByCase.set(a.caseId, list);
}

for (const [key, { file, set }] of Object.entries(GENERATED)) {
  const gen = loadJson<GeneratedFile>(resolve(GEN_ROOT, file));
  if (!gen) { console.log(`[${set}] ${file} missing`); continue; }
  const missing: string[] = [];
  const wronglyIn: string[] = [];
  for (const c of gen.cases) {
    const caseDef = casesByKey.get(`${c.caseDef.subsetId}|${c.caseDef.caseNumber}`);
    const present = new Map(
      (caseDef ? algsByCase.get(caseDef.id) ?? [] : []).map((x) => [`${x.slot}|${x.moves}`, true]),
    );
    for (const a of c.algorithms) {
      const rk = `${set}|${c.caseDef.caseNumber}|${a.moves.join(" ")}`;
      const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1] ?? "";
      const inSeed = present.has(`${slot}|${JSON.stringify(collapseConsecutive(a.moves))}`);
      const failed = failKeys.has(rk);
      const invalid = isInvalidAlg(a.moves);
      if (!failed && !invalid && !inSeed) {
        missing.push(`VERIFIED-MISSING case=${c.caseDef.caseNumber} [${slot}] ${a.moves.join(" ")} (isDefault=${a.isDefault})`);
      }
      if (failed && inSeed) {
        wronglyIn.push(`FAILED-IN-SEED case=${c.caseDef.caseNumber} [${slot}] ${a.moves.join(" ")}`);
      }
    }
  }
  if (missing.length || wronglyIn.length) {
    console.log(`\n[${set}] ${file}:`);
    for (const m of missing) console.log("  ", m);
    for (const w of wronglyIn) console.log("  ", w);
  } else {
    console.log(`[${set}] OK`);
  }
}
