/**
 * Test — ¿Qué % de las reconstrucciones 3x3 se resuelven con nuestro análisis?
 *
 * Muestrea N solves 3x3 aleatorios del dataset `apps/web/public/reconstructions/`
 * (14.565 registros de cuberoot + reconz) y les corre `analyzeSolveText`
 * (el mismo pipeline CFOP que usa OurDetectionPanel). Reporta:
 *
 *   - finalSolved      → el stream termina en cubo resuelto (verdicto del motor)
 *   - complete         → se detectaron las 4 fases CFOP (Cross/F2L/OLL/PLL)
 *   - warnings         → p.ej. "scramble-only-seed", "final-state-not-solved"
 *   - comparación con el `recognition.finalSolved` horneado en el dataset
 *
 * Uso:
 *   pnpm dlx tsx pruebas/scripts/analyze-recon-success.ts            # 20 muestras 3x3
 *   pnpm dlx tsx pruebas/scripts/analyze-recon-success.ts --n 100    # 100 muestras
 *   pnpm dlx tsx pruebas/scripts/analyze-recon-success.ts --all      # las 13.694 3x3
 *   pnpm dlx tsx pruebas/scripts/analyze-recon-success.ts --cfop     # solo CFOP
 *   pnpm dlx tsx pruebas/scripts/analyze-recon-success.ts --seed 7   # PRNG reproducible
 */
import { analyzeSolveText } from "../../packages/analysis-engine/src/index";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "apps/web/public/recon-data/data");
const INDEX_PATH = path.join(ROOT, "apps/web/public/recon-data/index.json");

// ─── Args ──────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]) {
  const args: { n: number; all: boolean; cfop: boolean; seed: number } = {
    n: 20,
    all: false,
    cfop: false,
    seed: 42,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.all = true;
    else if (a === "--cfop") args.cfop = true;
    else if (a === "--n") args.n = Number(argv[++i]);
    else if (a === "--seed") args.seed = Number(argv[++i]);
  }
  return args;
}

// ─── PRNG determinista (mulberry32) ────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample<T>(arr: T[], n: number, rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ─── Carga de datos ────────────────────────────────────────────────────────
interface IndexEntry {
  key: string;
  source: string;
  puzzle: string;
  method: string;
  methodGroup: string;
  time: number;
  stm: number | null;
  tps: number | null;
}
interface FullRecord extends IndexEntry {
  scramble: string;
  text: string;
  recognition?: { finalSolved: boolean; inspection: string; crossVerified: boolean };
  stats?: Record<string, unknown>;
}

const index: { solves: IndexEntry[]; chunkSize: number } = JSON.parse(
  fs.readFileSync(INDEX_PATH, "utf8"),
);

const chunkCache = new Map<number, { solves: FullRecord[] }>();
function loadRecord(entry: IndexEntry): FullRecord {
  const rank = index.solves.findIndex((e) => e.key === entry.key);
  const chunk = Math.floor(rank / index.chunkSize);
  if (!chunkCache.has(chunk)) {
    chunkCache.set(
      chunk,
      JSON.parse(
        fs.readFileSync(
          path.join(DATA_DIR, `chunk-${String(chunk).padStart(3, "0")}.json`),
          "utf8",
        ),
      ),
    );
  }
  return chunkCache.get(chunk)!.solves.find((s) => s.key === entry.key)!;
}

// ─── Análisis ──────────────────────────────────────────────────────────────
function analyzeRecord(rec: FullRecord) {
  try {
    const result = analyzeSolveText({
      setup: rec.scramble ?? "",
      inspection: rec.recognition?.inspection || undefined,
      solution: rec.text ?? "",
      method: "CFOP",
      totalTimeMs: rec.time > 0 ? rec.time * 1000 : undefined,
    });
    const recon = result.reconstruction;
    const report = result.timeline.detectionReport;
    return {
      ok: true as const,
      finalSolved: recon.finalSolved,
      complete: report?.complete ?? false,
      warnings: recon.warnings ?? [],
      rotations: recon.rotations.length,
      crossMoves: recon.cross.moves.length,
      pairCount: recon.pairs.length,
      oll: recon.oll ? (recon.oll.skipped ? "skip" : "detected") : "none",
      pll: recon.pll ? (recon.pll.skipped ? "skip" : "detected") : "none",
      ms: -1,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  const all3x3 = index.solves.filter((e) => e.puzzle === "3x3");
  const cfop3x3 = all3x3.filter((e) => e.methodGroup === "CFOP");
  const pool = args.cfop ? cfop3x3 : all3x3;

  const rand = mulberry32(args.seed);
  const sampleEntries = args.all ? pool : sample(pool, args.n, rand);

  console.log(`\n=== Análisis CFOP sobre reconstrucciones 3x3 ===`);
  console.log(
    `Dataset: ${index.solves.length} solves | 3x3: ${all3x3.length} | CFOP 3x3: ${cfop3x3.length}`,
  );
  console.log(
    `Muestra: ${sampleEntries.length} solves (${args.all ? "TODAS" : `aleatorias, seed=${args.seed}`}${args.cfop ? ", solo CFOP" : ", todos los métodos"})\n`,
  );

  const rows: {
    key: string;
    method: string;
    baked: boolean | null;
    finalSolved: boolean;
    complete: boolean;
    warnings: string[];
    detail: string;
  }[] = [];

  let solved = 0;
  let complete = 0;
  let errored = 0;
  let noScramble = 0;
  const startTotal = Date.now();
  const warnCounts = new Map<string, number>();
  const byMethod: Record<string, { n: number; solved: number }> = {};

  for (const entry of sampleEntries) {
    const rec = loadRecord(entry);
    if (!rec.scramble || !rec.scramble.trim()) noScramble++;

    const t0 = Date.now();
    const r = analyzeRecord(rec);
    const ms = Date.now() - t0;

    const baked = rec.recognition?.finalSolved ?? null;
    const mg = entry.methodGroup || "Other";
    byMethod[mg] ??= { n: 0, solved: 0 };
    byMethod[mg].n++;
    if (r.ok) {
      if (r.finalSolved) {
        solved++;
        byMethod[mg].solved++;
      }
      if (r.complete) complete++;
      for (const w of r.warnings) warnCounts.set(w, (warnCounts.get(w) ?? 0) + 1);
      const detail =
        `cross=${r.crossMoves} pairs=${r.pairCount} ` +
        `oll=${r.oll} pll=${r.pll} rot=${r.rotations} [${r.warnings.join(",") || "sin-warnings"}]`;
      rows.push({
        key: entry.key,
        method: entry.method,
        baked,
        finalSolved: r.finalSolved,
        complete: r.complete,
        warnings: r.warnings,
        detail,
      });
      if (!args.all) {
        console.log(
          `${r.finalSolved ? "✅" : "❌"} ${entry.key.padEnd(18)} ${entry.method.padEnd(10)} ${entry.source.padEnd(8)} ${String(ms).padStart(4)}ms  ${detail}`,
        );
      }
    } else {
      errored++;
      rows.push({
        key: entry.key,
        method: entry.method,
        baked,
        finalSolved: false,
        complete: false,
        warnings: [],
        detail: `ERROR: ${r.error}`,
      });
      console.log(`💥 ${entry.key.padEnd(18)} ${entry.method.padEnd(10)} ERROR: ${r.error}`);
    }
  }

  const totalSec = ((Date.now() - startTotal) / 1000).toFixed(1);
  const n = sampleEntries.length;
  const pct = (c: number) => `${((c / n) * 100).toFixed(1)}%`;

  console.log(`\n=== RESUMEN (${n} solves, ${totalSec}s) ===`);
  console.log(`  Resueltas por el análisis (finalSolved):  ${solved}  (${pct(solved)})`);
  console.log(`  Con 4 fases CFOP completas detectadas:     ${complete}  (${pct(complete)})`);
  console.log(`  Errores de API (thrown):                   ${errored}`);
  console.log(`  Sin scramble en el dataset:                ${noScramble}`);

  console.log(`\n  Por método (grupo):`);
  for (const [mg, s] of Object.entries(byMethod)) {
    console.log(`    ${mg.padEnd(8)} ${String(s.n).padStart(6)} solves → ${s.solved} resueltas (${((s.solved / s.n) * 100).toFixed(1)}%)`);
  }

  const bakedTrue = rows.filter((r) => r.baked === true).length;
  const bakedFalse = rows.filter((r) => r.baked === false).length;
  const bakedNull = rows.filter((r) => r.baked === null).length;
  console.log(`\n  recognition.finalSolved horneado en dataset:`);
  console.log(`    true: ${bakedTrue} | false: ${bakedFalse} | ausente: ${bakedNull}`);

  if (warnCounts.size > 0) {
    console.log(`\n  Warnings más comunes:`);
    for (const [w, c] of [...warnCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${w.padEnd(34)} ${c}  (${pct(c)})`);
    }
  }

  // Veredicto del motor vs veredicto horneado (solo donde ambos existen)
  const both = rows.filter((r) => r.baked !== null);
  const agree = both.filter((r) => r.baked === r.finalSolved).length;
  console.log(`\n  Coincidencia motor vs baked (donde baked existe): ${agree}/${both.length} ${both.length ? `(${((agree / both.length) * 100).toFixed(1)}%)` : ""}`);
}

main();
