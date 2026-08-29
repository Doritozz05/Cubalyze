/**
 * build-recon-web-data.ts — generate the web Reconstructions dataset.
 *
 * Sources:
 *   - pruebas/generated/cuberoot-solves.json (1594 solves, solution text)
 *   - pruebas/generated/reconz-solves.json   (12971 solves, steps[] + dates)
 *
 * Output (apps/web/public/reconstructions/):
 *   - index.json               → list metadata for every solve (solver, time,
 *                                date, competition, method, tags, url).
 *   - data/chunk-XXX.json      → full records (scramble, parsed phases, raw
 *                                text, stats).
 *
 * Recognition: the top-level `recognition` block (finalSolved / inspection /
 * crossVerified) was baked by the v1 analyzer, which the `algortihms` branch
 * removed (Fase 0). To keep it without re-running a removed module, this
 * script MERGES the current `public/reconstructions/data/*` chunks back in
 * by key, and only refreshes the metadata fields (date, reconstructor,
 * records, …). The per-phase case detection (`recog`) was part of the v1
 * recognition system and is intentionally NOT preserved — the case chips
 * were removed from the UI. Re-run whenever the crawls or metadata mapping
 * improve.
 *
 * PUZZLE FILTER: by default ONLY 3×3-family solves are imported (the
 * recognition pipeline and the case database are 3×3; 2×2/Pyraminx/etc.
 * recons are excluded — e.g. CubeRoot #2407 is a 2×2 whose transcription
 * does not even solve its own scramble). Pass `--all` to import every
 * puzzle (the UI puzzle filter then applies). Every index entry carries a
 * normalized `puzzle` field.
 *
 * Run: pnpm dlx tsx pruebas/scripts/build-recon-web-data.ts [--all]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "../apps/web/public/recon-data");
const CHUNK = 300;

// ─── Source types ───────────────────────────────────────────────────────────

interface CuberootSolve {
  id: number;
  official?: string;
  event?: string;
  method?: string;
  competition?: string;
  country?: string;
  solveNum?: number;
  solver?: string;
  rawTime?: number;
  average?: number;
  recordAverage?: string;
  record?: string;
  solution?: string;
  /** Official WCA scramble when CubeRoot publishes it (preferred). */
  scramble?: string;
  /** CubeRoot's own scramble for the same state — fallback when the WCA
   *  scramble is absent (present on ~98% of the pages that lack wcaScramble;
   *  validated to solve the solution text on ~95.5% of those). */
  optimalScramble?: string;
  stm?: number;
  tps?: number;
  pll?: string;
  pllShort?: string;
  freePair?: number;
  yRot?: number;
  regrip?: number;
  lockup?: number;
  crossType?: number;
  crossStm?: number;
  f2l?: number;
  ll?: number;
  sMove?: number;
  crossColor?: string;
  videoUrl?: string;
  url?: string;
  tags?: string[];
  date?: string;
  reconer?: string;
  cube?: string;
  compWcaId?: string;
}

interface ReconzStep {
  moves?: string;
  comment?: string;
}
interface ReconzSolve {
  id: number;
  solver?: string;
  time?: number;
  puzzle?: string;
  record?: string | null;
  date?: string;
  competition?: string;
  reconstructor?: string;
  scramble?: string;
  steps?: ReconzStep[];
  stats?: Record<string, Record<string, string>>;
}

// ─── Web record shapes ──────────────────────────────────────────────────────

export interface ReconIndexEntry {
  key: string;
  source: "cuberoot" | "reconz";
  id: number;
  solver: string;
  time: number; // seconds
  date: string | null;
  competition: string;
  method: string;
  methodGroup: "CFOP" | "Roux" | "Other";
  /** Normalized puzzle label ("3x3", "2x2", "pyraminx", …). */
  puzzle: string;
  stm: number | null;
  tps: number | null;
  tags: string[];
  url: string | null;
}

export interface ReconPhase {
  label: string;
  moves: string;
  moveCount: number;
}

export interface ReconFullRecord extends ReconIndexEntry {
  scramble: string;
  text: string;
  phases: ReconPhase[];
  /** Reconstructor credits (reco.nz: Brest/Stewy/…, CubeRoot: reconer). */
  reconstructor?: string | null;
  /** Single-solve record tag (WR/NR/PR…) when the source reports one. */
  record?: string | null;
  /** CubeRoot: round average for the solve (seconds). */
  average?: number | null;
  /** CubeRoot: solve number within the round (1..5). */
  solveNum?: number | null;
  /** CubeRoot: cube model used. */
  cube?: string | null;
  /** CubeRoot: ISO country code. */
  country?: string | null;
  /** CubeRoot: official flag ("wca"…). */
  official?: string | null;
  /** CubeRoot: WCA competition id. */
  compWcaId?: string | null;
  stats: {
    crossStm?: number | null;
    f2l?: number | null;
    ll?: number | null;
    yRot?: number | null;
    regrip?: number | null;
    freePair?: number | null;
    sMove?: number | null;
    crossColor?: string | null;
    videoUrl?: string | null;
    recordAverage?: string | null;
  };
  recognition: {
    finalSolved: boolean;
    inspection: string;
    crossVerified: boolean;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Clean a cuberoot solution line into (moves, label). */
function cleanSolutionLine(raw: string): { moves: string; label: string } | null {
  let line = raw.trim();
  if (!line) return null;
  // Strip trailing parenthetical timing annotations from the label only.
  const [movesPart, labelPart] = line.split("//");
  const moves = (movesPart ?? "")
    .replace(/↑/g, "")
    .replace(/·/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const label = (labelPart ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!moves && !label) return null;
  return { moves, label };
}

const SLOT_LABELS = /^(GO|BO|GR|RB|OB|OG|BG|RG)\b/i;

/**
 * Normalize a phase label into a canonical name so method-group detection
 * can recognize CFOP/Roux phase patterns (cross / f2l / oll / pll / …).
 */
function recogName(label: string): string {
  const l = label.toLowerCase();
  if (/insp/i.test(l)) return "Inspection";
  if (/cross/i.test(l)) return "Cross";
  if (/auf/i.test(l)) return "AUF";
  if (/oll/i.test(l) && !/f2l|pair/i.test(l)) return "OLL";
  if (/pll/i.test(l)) return "PLL";
  if (/f2l|pair/i.test(l)) return "F2L";
  if (SLOT_LABELS.test(label)) return "F2L"; // cuberoot slot shorthand (GO/BO/…)
  return label;
}

function isCfopIsh(names: string[]): boolean {
  const has = (re: RegExp) => names.some((n) => re.test(n));
  return has(/cross/i) && (has(/f2l|pair/i) || has(/^go$|^bo$|^gr$|^rb$/i));
}

function methodGroup(method: string | undefined, names: string[]): "CFOP" | "Roux" | "Other" {
  if (method && /roux/i.test(method)) return "Roux";
  if (method && /cfop/i.test(method)) return "CFOP";
  if (isCfopIsh(names)) return "CFOP";
  if (names.some((n) => /fb|cmll|lse|ss|sp/i.test(n))) return "Roux";
  return "Other";
}

function parseTime(raw?: number): number {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 100) / 100;
}

/**
 * Normalize a source event/puzzle string into a canonical puzzle label.
 * OH (one-handed) and 3BLD (blindfold) are still 3×3 cubes — grouped as
 * "3x3". Unknown events pass through lowercased.
 */
function puzzleOf(event: string | undefined | null): string {
  const e = (event ?? "").toLowerCase().trim();
  if (!e) return "unknown";
  if (e === "3x3" || e === "oh" || e === "3bld") return "3x3";
  if (e === "2x2") return "2x2";
  if (e === "4x4") return "4x4";
  if (e === "5x5") return "5x5";
  if (e === "6x6") return "6x6";
  if (e === "7x7") return "7x7";
  if (e === "pyraminx" || e === "pyra") return "pyraminx";
  if (e === "skewb") return "skewb";
  if (e === "sq1" || e === "square-1") return "square-1";
  if (e === "clock") return "clock";
  if (e === "megaminx") return "megaminx";
  return e;
}

function countMoves(moves: string): number {
  return moves.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Build ──────────────────────────────────────────────────────────────────

/**
 * Load the top-level `recognition` block (finalSolved / inspection /
 * crossVerified) currently baked in `public/reconstructions/data/*`
 * (produced by the v1 analyzer, removed in Fase 0) so a rebuild keeps it.
 * Keyed by record key. The per-phase case detection (`recog`) is NOT part
 * of this — the case chips were removed together with the recognition
 * system.
 */
function loadPrevRecognition(): Map<string, ReconFullRecord["recognition"]> {
  const map = new Map<string, ReconFullRecord["recognition"]>();
  const dataDir = resolve(OUT, "data");
  if (!existsSync(dataDir)) return map;
  for (const f of readdirSync(dataDir).filter((x: string) => x.endsWith(".json"))) {
    let chunk: { solves?: ReconFullRecord[] };
    try {
      chunk = JSON.parse(readFileSync(resolve(dataDir, f), "utf-8"));
    } catch {
      continue;
    }
    for (const s of chunk.solves ?? []) {
      if (s.recognition) map.set(s.key, s.recognition);
    }
  }
  return map;
}

function build(): void {
  const cuberoot = JSON.parse(
    readFileSync(resolve(ROOT, "generated/cuberoot-solves.json"), "utf-8"),
  ) as Record<string, CuberootSolve>;
  const reconz = JSON.parse(
    readFileSync(resolve(ROOT, "generated/reconz-solves.json"), "utf-8"),
  ) as ReconzSolve[];

  // Preserve the recognition baked by the v1 analyzer (now removed) so the
  // rebuild never degrades the case chips / coherence badges.
  const prevRecognition = loadPrevRecognition();

  let records: ReconFullRecord[] = [];

  // ── CubeRoot ──────────────────────────────────────────────────────────
  for (const raw of Object.values(cuberoot)) {
    const solution = (raw.solution ?? "").trim();
    const parsed: { moves: string; label: string }[] = [];
    if (solution) {
      for (const line of solution.split("\n")) {
        const p = cleanSolutionLine(line);
        if (p) parsed.push(p);
      }
    }
    const names = parsed.map((p) => recogName(p.label));
    const method = raw.method || "Other";
    const key = `cuberoot-${raw.id}`;

    records.push({
      key,
      source: "cuberoot",
      id: raw.id,
      solver: raw.solver ?? "Unknown",
      time: parseTime(raw.rawTime),
      date: raw.date || null,
      competition: raw.competition ?? "",
      method,
      methodGroup: methodGroup(method, names),
      puzzle: puzzleOf(raw.event),
      stm: raw.stm ?? null,
      tps: raw.tps ?? null,
      // Surface the single-solve record (WR/NR/PR…) in the list too, exactly
      // like reco.nz does via its tags.
      tags: [...(raw.record ? [raw.record] : []), ...(raw.tags ?? [])],
      url: raw.url ?? null,
      reconstructor: raw.reconer ?? null,
      record: raw.record ?? null,
      average: raw.average ?? null,
      solveNum: raw.solveNum ?? null,
      cube: raw.cube ?? null,
      country: raw.country ?? null,
      official: raw.official ?? null,
      compWcaId: raw.compWcaId ?? null,
      // Prefer the official WCA scramble; fall back to CubeRoot's own
      // optimalScramble (the primary scramble shown on the recon page) when
      // the page never published the WCA one.
      scramble: raw.scramble || raw.optimalScramble || "",
      text: solution,
      phases: parsed.map((p) => ({
        label: p.label,
        moves: p.moves,
        moveCount: countMoves(p.moves),
      })),
      stats: {
        crossStm: raw.crossStm ?? null,
        f2l: raw.f2l ?? null,
        ll: raw.ll ?? null,
        yRot: raw.yRot ?? null,
        regrip: raw.regrip ?? null,
        freePair: raw.freePair ?? null,
        sMove: raw.sMove ?? null,
        crossColor: raw.crossColor ?? null,
        videoUrl: raw.videoUrl ?? null,
        recordAverage: raw.recordAverage ?? null,
      },
      recognition: { finalSolved: false, inspection: "", crossVerified: false },
    });
  }

  // ── Reco.nz ───────────────────────────────────────────────────────────
  for (const raw of reconz) {
    const steps = (raw.steps ?? []).filter((s) => s?.moves?.trim());
    const parsed = steps.map((s) => ({
      moves: s.moves!.trim(),
      label: (s.comment ?? "").trim() || "Step",
    }));
    const names = parsed.map((p) => recogName(p.label));
    const method =
      methodGroup(undefined, names) === "CFOP"
        ? "CFOP"
        : methodGroup(undefined, names) === "Roux"
          ? "Roux"
          : "Other";
    const key = `reconz-${raw.id}`;

    // Reassemble a readable raw text from the steps (reconz stores steps, not
    // a free-form text block).
    const text = steps
      .map((s) => `${s.moves!.trim()} // ${(s.comment ?? "").trim()}`)
      .join("\n");

    const stm = raw.stats?.["STM"]?.["Total"];
    const stmN = stm && stm !== "n/a" ? parseInt(stm, 10) : null;

    records.push({
      key,
      source: "reconz",
      id: raw.id,
      solver: raw.solver ?? "Unknown",
      time: parseTime(raw.time),
      date: raw.date ?? null,
      competition: raw.competition ?? "",
      method,
      methodGroup: methodGroup(undefined, names),
      puzzle: puzzleOf(raw.puzzle),
      stm: stmN,
      tps: null,
      tags: raw.record ? [raw.record] : [],
      url: null,
      reconstructor: raw.reconstructor ?? null,
      record: raw.record ?? null,
      scramble: raw.scramble ?? "",
      text,
      phases: parsed.map((p) => ({
        label: p.label,
        moves: p.moves,
        moveCount: countMoves(p.moves),
      })),
      stats: {},
      recognition: { finalSolved: false, inspection: "", crossVerified: false },
    });
  }

  // ── Puzzle filter ────────────────────────────────────────────────────
  // Default: 3×3-family only (the recognition + case DB are 3×3). `--all`
  // imports every puzzle; the UI filter then lets users pick.
  const includeAll = process.argv.includes("--all");
  const before = records.length;
  if (!includeAll) records = records.filter((r) => r.puzzle === "3x3");
  const byPuzzle: Record<string, number> = {};
  for (const r of records) byPuzzle[r.puzzle] = (byPuzzle[r.puzzle] ?? 0) + 1;

  // ── Preserve previously baked top-level recognition (v1 analyzer removed
  // in Fase 0). The current web dataset carries finalSolved / inspection /
  // crossVerified baked by the v1 analyzer; merge it back by key so a
  // rebuild keeps it. The per-phase case detection (`recog`) is NOT merged
  // — the case chips were removed with the recognition system.
  if (prevRecognition.size === 0) {
    console.warn(
      "WARNING: no previous chunks found — recognition will be EMPTY " +
        "(finalSolved=false). The v1 analyzer was removed in Fase 0; only " +
        "the existing public/reconstructions/data/* preserves it.",
    );
  }
  let merged = 0;
  for (const r of records) {
    const prev = prevRecognition.get(r.key);
    if (!prev) continue;
    r.recognition = prev;
    merged++;
  }

  // ── Emit index + chunks ───────────────────────────────────────────────
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(resolve(OUT, "data"), { recursive: true });

  const index: ReconIndexEntry[] = records.map(
    ({ key, source, id, solver, time, date, competition, method, methodGroup, puzzle, stm, tps, tags, url }) => ({
      key, source, id, solver, time, date, competition, method, methodGroup, puzzle,
      stm, tps, tags, url,
    }),
  );
  // Missing times (0) sort last — they are unknown, not world records.
  index.sort(
    (a, b) =>
      (a.time <= 0 ? 1e9 : a.time) - (b.time <= 0 ? 1e9 : b.time) ||
      a.solver.localeCompare(b.solver),
  );

  const byKey = new Map(records.map((r) => [r.key, r]));
  const sortedKeys = index.map((e) => e.key);
  for (let c = 0; c < sortedKeys.length; c += CHUNK) {
    const slice = sortedKeys.slice(c, c + CHUNK);
    writeFileSync(
      resolve(OUT, `data/chunk-${String(c / CHUNK).padStart(3, "0")}.json`),
      JSON.stringify({ solves: slice.map((k) => byKey.get(k)!) }),
      "utf-8",
    );
  }

  writeFileSync(
    resolve(OUT, "index.json"),
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        count: index.length,
        chunkSize: CHUNK,
        solves: index,
      },
      null,
      1,
    ),
    "utf-8",
  );

  const byGroup: Record<string, number> = {};
  for (const r of records) byGroup[r.methodGroup] = (byGroup[r.methodGroup] ?? 0) + 1;
  const bySource: Record<string, number> = {};
  for (const r of records) bySource[r.source] = (bySource[r.source] ?? 0) + 1;

  console.log(`total records: ${records.length} (filtered from ${before}, ${includeAll ? "--all" : "3x3-only"})`);
  console.log(`by source:     ${JSON.stringify(bySource)}`);
  console.log(`by group:      ${JSON.stringify(byGroup)}`);
  console.log(`by puzzle:     ${JSON.stringify(byPuzzle)}`);
  console.log(`recognition:   ${merged} top-level blocks merged from previous chunks`);
  console.log(`chunks:        ${Math.ceil(index.length / CHUNK)} → ${OUT}`);
}

build();
