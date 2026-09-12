"use client";

import type { Penalty, SolveMethod, SolveSource } from "@/types";
import { normalizePenalty } from "@/types";
import { WCA_EVENT_CODES } from "@cubeforge/events";
import { methodForEvent } from "@/utils/puzzleUtils";
import type { CubeMoveEvent, OrientationTimeline, SolveMetrics } from "@cubeforge/types";

/* ──────────────────────────────────────────────────────────────────────────
   Import format identifiers
   ─────────────────────────────────────────────────────────────────────── */

export type ImportFormat = "cstimer" | "cstimer-json" | "twistytimer" | "cubeforge-csv" | "cubeforge-json" | "generic-csv" | "unknown";

export interface ImportPreview {
  format: ImportFormat;
  /** Number of rows successfully parsed. */
  rowCount: number;
  /** Number of rows that failed to parse. */
  errorCount: number;
  /** First 5 rows for preview in the UI. */
  samples: ImportedSolve[];
  /** Column headers detected (for generic CSV). */
  headers: string[];
  /** Original raw lines (for debugging). */
  rawLines: string[];
}

export interface ImportedSolve {
  time: number;
  penalty: Penalty;
  scramble: string;
  timestamp: number;
  method?: SolveMethod;
  note?: string;
  puzzle?: string;
  category?: string;
  /** Puzzle type for this solve (e.g. '333', '222'). */
  puzzleType?: string;
  /** How the solve was recorded ('smart' | 'manual') — preserved from CubeForge JSON. */
  source?: SolveSource;
  /** Raw moves captured from a Smart Cube / virtual solve — full-fidelity JSON. */
  moves?: CubeMoveEvent[];
  /** Post-solve analysis metrics — full-fidelity JSON. */
  analysis?: SolveMetrics;
  /** Compact gyro/orientation timeline — full-fidelity JSON. */
  orientationTimeline?: OrientationTimeline;
}

export interface ImportResult {
  solves: ImportedSolve[];
  errors: { line: number; message: string }[];
  format: ImportFormat;
}

/* ──────────────────────────────────────────────────────────────────────────
   Format detection
   ─────────────────────────────────────────────────────────────────────── */

/**
 * Detect the import format from the first few lines of content.
 *
 * csTimer JSON: {"session1":[[[0,73521],"scramble","",1737013787],...],...,"properties":{...}}
 * csTimer CSV:  "333";"Normal";"122170";"1620000000000";"R U R' U'...";"0";""
 * TwistyTimer:  "54.03";"R U R' U'";"2025-01-08T19:50:06.520+01:00"
 * CubeForge:    No.,Time,Penalty,Scramble,Date,Method,Note
 * generic CSV:  any comma or tab delimited data with a header row
 * JSON:         starts with `{` or `[`
 */
/**
 * Newer csTimer CSV exports carry a header row like
 * `No.;Time;Comment;Scramble;Date;P.1` (unquoted, semicolon-delimited).
 * The "Time" column sits right after the semicolon following "No.".
 */
const CSTIMER_HEADER_RE = /^no\.?\s*;\s*time\s*;/i;

/**
 * TwistyTimer CSV rows look like: `"54.03";"R U R' U'";"2025-01-08T19:50:06.520+01:00"`
 * — exactly 3 quoted semicolon-delimited fields: WCA time, scramble, ISO date with
 * timezone offset, and NO header row.
 */
function looksLikeTwistyTimerLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('"')) return false;
  const fields = splitCSVLine(t, ";");
  if (fields.length < 3 || fields.length > 5) return false;
  const time = unquote(fields[0] ?? "").trim();
  const date = unquote(fields[2] ?? "").trim();
  const timeOk = parseWcaTimeWithPenalty(time) !== null;
  const dateOk = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date);
  return timeOk && dateOk;
}

export function detectFormat(content: string): ImportFormat {
  const trimmed = content.trim();

  // JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      // csTimer JSON export: has session1, session2, ... keys + optional properties
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        const sessionKeys = keys.filter((k: string) => /^session\d+$/.test(k));
        if (sessionKeys.length > 0 && sessionKeys.length >= keys.length - 1) {
          // Most keys are sessionN (+ optional "properties")
          return "cstimer-json";
        }
        // CubeForge JSON: has "app", "solves", etc.
        if (parsed.app === "CubeForge" && Array.isArray(parsed.solves)) {
          return "cubeforge-json";
        }
        return "cubeforge-json";
      }
      return "cubeforge-json";
    } catch {
      return "unknown";
    }
  }

  const lines = trimmed.split("\n");
  const firstLine = lines[0]?.trim() ?? "";

  // TwistyTimer: "time";"scramble";"date" — 3 quoted fields, WCA time + ISO date
  // (checked before the classic csTimer check since it also uses ";")
  if (lines.slice(0, 3).some((l) => looksLikeTwistyTimerLine(l))) {
    return "twistytimer";
  }

  // csTimer: semicolon-delimited with quoted fields
  if (firstLine.includes('";"')) {
    return "cstimer";
  }

  // csTimer (newer): unquoted header CSV — `No.;Time;Comment;Scramble;Date;P.1`
  if (CSTIMER_HEADER_RE.test(firstLine)) {
    return "cstimer";
  }

  // CubeForge CSV: comma-delimited with known header
  if (firstLine.startsWith("No.,Time,Penalty,Scramble,Date,Method,Note")) {
    return "cubeforge-csv";
  }

  // Generic CSV: has commas, might have headers
  if (firstLine.includes(",") || firstLine.includes("\t")) {
    return "generic-csv";
  }

  return "unknown";
}

/* ──────────────────────────────────────────────────────────────────────────
   csTimer format parser
   Format: "Puzzle";"Category";"Time(millis)";"Date(epoch)";"Scramble";"Penalty";"Comment"
   Time is in milliseconds (integer).
   Date is epoch milliseconds.
   Penalty: 0 = none, 1 = +2, 2 = DNF (varies, we normalise)
   ─────────────────────────────────────────────────────────────────────── */

function parseCsTimerLine(line: string, _index: number): ImportedSolve | null {
  // Split by semicolons, respecting quoted fields
  const fields = splitCSVLine(line, ";");
  if (fields.length < 6) return null;

  const puzzle = unquote(fields[0] ?? "");
  const category = unquote(fields[1] ?? "");
  const timeRaw = unquote(fields[2] ?? "");
  const dateRaw = unquote(fields[3] ?? "");
  const scramble = unquote(fields[4] ?? "");
  const penaltyRaw = unquote(fields[5] ?? "");
  const comment = fields.length > 6 ? unquote(fields[6] ?? "") : "";

  const timeMs = parseInt(timeRaw, 10);
  if (isNaN(timeMs) || timeMs < 0) return null;

  let timestamp: number;
  const dateNum = parseInt(dateRaw, 10);
  if (!isNaN(dateNum) && dateNum > 0) {
    timestamp = dateNum;
  } else {
    // Try ISO date
    const parsed = Date.parse(dateRaw);
    timestamp = !isNaN(parsed) ? parsed : Date.now();
  }

  const penalty = mapCsTimerPenalty(penaltyRaw);

  return {
    time: timeMs,
    penalty,
    scramble: scramble || "",
    timestamp,
    note: comment || undefined,
    puzzle: puzzle || undefined,
    category: category || undefined,
    puzzleType: mapPuzzleCode(puzzle) ?? inferPuzzleType(scramble || ""),
  };
}

function mapCsTimerPenalty(raw: string): Penalty {
  const n = raw.trim();
  // csTimer uses "0" for none, "2000" or "1" for +2, "-1" or "2" for DNF
  if (n === "-1" || n === "2" || n.toLowerCase() === "dnf") return "DNF";
  if (n === "2000" || n === "1" || n === "+2") return "+2";
  return "none";
}

/* ──────────────────────────────────────────────────────────────────────────
   TwistyTimer CSV parser
   Format: "time";"scramble";"date"
   - quoted, semicolon-delimited, NO header row
   - Time in WCA format ("54.03", "1:06.74"), may carry "+2" suffix or be "DNF"
   - Date in ISO-8601 with timezone ("2025-01-08T19:50:06.520+01:00")
   ─────────────────────────────────────────────────────────────────────── */

function parseTwistyTimerLine(line: string, _lineNum: number): ImportedSolve | null {
  const fields = splitCSVLine(line, ";");
  if (fields.length < 3) return null;
  const timeRaw = unquote(fields[0] ?? "");
  const scramble = unquote(fields[1] ?? "");
  const dateRaw = unquote(fields[2] ?? "");

  if (!timeRaw) return null;

  const parsedTime = parseWcaTimeWithPenalty(timeRaw);
  if (parsedTime === null) return null;
  const timeMs = parsedTime.timeMs;
  let penalty: Penalty = parsedTime.penalty;
  let note: string | undefined = undefined;

  for (let i = 3; i < fields.length; i++) {
    const extra = unquote(fields[i] ?? "").trim();
    if (!extra) continue;
    const upper = extra.toUpperCase();
    if (upper === "DNF") {
      penalty = "DNF";
    } else if (upper === "+2" || upper === "+") {
      penalty = "+2";
    } else if (!note) {
      note = extra;
    }
  }

  let timestamp = Date.now();
  if (dateRaw) {
    const parsed = Date.parse(dateRaw);
    if (!isNaN(parsed)) timestamp = parsed;
  }

  return {
    time: timeMs,
    penalty,
    scramble: scramble || "",
    timestamp,
    note,
    puzzleType: inferPuzzleType(scramble || ""),
  };
}

function parseTwistyTimerCsv(content: string): ImportResult {
  const lines = content.trim().split("\n");
  const solves: ImportedSolve[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    // Skip potential header rows like "Time";"Scramble";"Date"
    const first = unquote(splitCSVLine(line, ";")[0] ?? "").trim();
    if (looksLikeHeaderField(first)) continue;
    const solve = parseTwistyTimerLine(line, i + 1);
    if (solve) {
      solves.push(solve);
    } else {
      errors.push({ line: i + 1, message: "Could not parse line" });
    }
  }

  return { solves, errors, format: "twistytimer" };
}

/* ──────────────────────────────────────────────────────────────────────────
   csTimer header CSV parser (newer export format)
   Format: No.;Time;Comment;Scramble;Date;P.1
   - semicolon-delimited WITHOUT quotes
   - Time in WCA format ("1:13.52", "47.41")
   - Date in human-readable format ("2025-01-16 08:49:47")
   - optional trailing penalty/effective-time column ("P.1", "Penalty", ...)
   ─────────────────────────────────────────────────────────────────────── */

/** Parse a WCA-format time ("1:13.52", "47.41") into milliseconds. */
function parseWcaTimeMs(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1]!, 10) : 0;
  const seconds = parseInt(m[2]!, 10);
  const frac = m[3] ? parseInt(m[3]!.padEnd(3, "0").slice(0, 3), 10) : 0;
  return minutes * 60000 + seconds * 1000 + frac;
}

/**
 * Parse a WCA-format time string that may carry penalty markers:
 *   "46.07"             → { timeMs: 46070, penalty: "none" }
 *   "46.07+" / "46.07+2" → { timeMs: 46070, penalty: "+2" }
 *   "DNF"               → { timeMs: 0, penalty: "DNF" }
 *   "DNF(44.83)"        → { timeMs: 44830, penalty: "DNF" } (raw time from parens)
 */
function parseWcaTimeWithPenalty(raw: string): { timeMs: number; penalty: Penalty } | null {
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();

  if (upper === "DNF") return { timeMs: 0, penalty: "DNF" };

  const dnfMatch = upper.match(/^DNF\(([\d:.]+)\)$/);
  if (dnfMatch) {
    const inner = parseWcaTimeMs(dnfMatch[1]!);
    if (inner === null) return null;
    return { timeMs: inner, penalty: "DNF" };
  }

  const plusMatch = t.match(/^(.*)\+2?$/);
  if (plusMatch) {
    const inner = parseWcaTimeMs(plusMatch[1]!);
    if (inner === null) return null;
    return { timeMs: inner, penalty: "+2" };
  }

  const plain = parseWcaTimeMs(t);
  if (plain === null) return null;
  return { timeMs: plain, penalty: "none" };
}

/**
 * Map a csTimer puzzle code ("333", "222", "222so") to a puzzleType.
 * ADR-002: the DB stores WCA event codes, so the code IS the puzzle type
 * (identity) — with 3×3-family variant prefixes ("333oh" etc.) preserved.
 */
const WCA_CODE_SET = new Set<string>(WCA_EVENT_CODES);

function mapPuzzleCode(code: string): string | undefined {
  const c = code.trim().toLowerCase();
  // ADR-002: an exact WCA code IS the puzzle type (identity). csTimer uses
  // the same codes, so "333oh" stays "333oh" — it must NEVER collapse into
  // "333" (that was the OH-mixed-with-3x3 bug, phase D1).
  if (WCA_CODE_SET.has(c)) return c;
  // csTimer non-official variants (e.g. "222so") collapse to the base family.
  if (c.startsWith("222")) return "222";
  if (c.startsWith("333")) return "333";
  if (c.startsWith("444")) return "444";
  if (c.startsWith("555")) return "555";
  if (c.startsWith("666")) return "666";
  if (c.startsWith("777")) return "777";
  return undefined;
}

/**
 * Legacy puzzle_type spellings written before the WCA-code migration
 * (ADR-002, migration 027): '3x3x3'/'3x3' → '333', '2x2x2'/'2x2' → '222',
 * and the other pre-ADR canonical NxNxN codes. Mirrors migration 027's CASE
 * so a JSON export made on an older build still imports cleanly after the
 * migration (the DB + repositories reject anything that is not a WCA code).
 */
const LEGACY_PUZZLE_TYPE_TO_WCA: Record<string, string> = {
  "3x3x3": "333",
  "3x3": "333",
  "2x2x2": "222",
  "2x2": "222",
  "4x4x4": "444",
  "5x5x5": "555",
  "6x6x6": "666",
  "7x7x7": "777",
};

/** Normalize any incoming puzzle_type to a WCA event code (or '333'). */
function normalizePuzzleType(raw: string | undefined): string {
  if (!raw) return "333";
  const c = raw.trim().toLowerCase();
  if (WCA_CODE_SET.has(c)) return c;
  return LEGACY_PUZZLE_TYPE_TO_WCA[c] ?? "333";
}

/**
 * Infer the puzzle type from a scramble when the file carries no explicit
 * puzzle column.
 *
 * WCA 2×2 scrambles only use the R, U and F faces and are ≤ 11 moves;
 * 3×3 scrambles use all six faces (~20 moves). If every move is an R/U/F
 * turn and the scramble is short, it's almost certainly a 2×2.
 */
function inferPuzzleType(scramble: string): string {
  const moves = scramble.trim().split(/\s+/).filter(Boolean);
  if (moves.length === 0) return "333";
  const faces = new Set(moves.map((mv) => mv.replace(/^([RLUDFB]).*$/, "$1")));
  const onlyRuf = [...faces].every((f) => f === "R" || f === "U" || f === "F");
  if (onlyRuf && moves.length <= 12) return "222";
  return "333";
}

interface CsTimerHeaderMap {
  time: number;
  comment: number;
  scramble: number;
  date: number;
  penalty: number;
}

function mapCsTimerHeader(headers: string[]): CsTimerHeaderMap {
  const find = (pattern: RegExp): number => {
    for (let i = 0; i < headers.length; i++) {
      if (pattern.test(headers[i]!.toLowerCase().trim())) return i;
    }
    return -1;
  };
  return {
    time: find(/^time/),
    comment: find(/^(comment|note)/),
    scramble: find(/^scramble/),
    date: find(/^date/),
    penalty: find(/^(pen|p\.?\d*$)/),
  };
}

/** Parse one data row of the csTimer header CSV format. */
function parseCsTimerHeaderLine(
  fields: string[],
  col: CsTimerHeaderMap,
  _lineNum: number,
): ImportedSolve | null {
  const get = (idx: number): string =>
    idx >= 0 && idx < fields.length ? unquote(fields[idx] ?? "") : "";

  const timeRaw = get(col.time);
  if (!timeRaw) return null;

  const parsedTime = parseWcaTimeWithPenalty(timeRaw);
  if (parsedTime === null) return null;
  let timeMs = parsedTime.timeMs;
  let penalty: Penalty = parsedTime.penalty;

  // Optional penalty / effective-time column ("P.1", "Penalty", ...)
  const pRaw = get(col.penalty);
  if (pRaw) {
    const pUpper = pRaw.trim().toUpperCase();
    if (pUpper === "DNF") {
      penalty = "DNF";
    } else if (pUpper.endsWith("+2") || pUpper.endsWith("+")) {
      penalty = "+2";
    } else if (penalty === "none") {
      // csTimer penalty codes ("0", "2000", "-1", "1", "2")
      const coded = mapCsTimerPenalty(pRaw);
      if (coded !== "none") {
        penalty = coded;
      }
    }
  }

  // In csTimer header CSV, the Time column (e.g. "46.07+") contains the penalty-adjusted time (raw + 2s).
  // The P.1 column (e.g. "44.07") contains the raw solve time.
  // CubeForge expects solve.time to be the RAW time, so effectiveTime(solve) = solve.time + 2000ms.
  if (penalty === "+2") {
    const pMs = pRaw ? parseWcaTimeMs(pRaw) : null;
    if (pMs !== null && pMs > 0 && pMs < timeMs) {
      timeMs = pMs;
    } else if (timeRaw.endsWith("+")) {
      timeMs = Math.max(0, timeMs - 2000);
    } else if (pMs !== null && pMs > 0) {
      timeMs = pMs;
    }
  }

  const scramble = get(col.scramble);
  const dateRaw = get(col.date);
  let timestamp = Date.now();
  if (dateRaw) {
    const iso = dateRaw.trim().replace(" ", "T");
    const parsed = Date.parse(iso);
    if (!isNaN(parsed)) timestamp = parsed;
  }

  return {
    time: timeMs,
    penalty,
    scramble: scramble || "",
    timestamp,
    note: get(col.comment) || undefined,
    puzzleType: inferPuzzleType(scramble || ""),
  };
}

/** Parse the newer csTimer header-based CSV export. */
function parseCsTimerHeaderCsv(content: string): ImportResult {
  const lines = content.trim().split("\n");
  const solves: ImportedSolve[] = [];
  const errors: { line: number; message: string }[] = [];

  // Locate the header row (first line starting with "No.")
  let headerIdx = -1;
  let col: CsTimerHeaderMap | null = null;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const fields = splitCSVLine(lines[i]!, ";").map((f) => unquote(f));
    if (fields.length >= 4 && /^no\.?$/i.test(fields[0] ?? "")) {
      headerIdx = i;
      col = mapCsTimerHeader(fields.map((f) => f.toLowerCase().trim()));
      break;
    }
  }
  if (headerIdx < 0 || !col) {
    return {
      solves: [],
      errors: [{ line: 0, message: "Could not find csTimer header row" }],
      format: "cstimer",
    };
  }
  if (col.time < 0) {
    return {
      solves: [],
      errors: [{ line: headerIdx + 1, message: "Could not find Time column in csTimer header" }],
      format: "cstimer",
    };
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const fields = splitCSVLine(line, ";").map((f) => unquote(f));
    const solve = parseCsTimerHeaderLine(fields, col, i + 1);
    if (solve) {
      solves.push(solve);
    } else {
      errors.push({ line: i + 1, message: "Could not parse line" });
    }
  }

  return { solves, errors, format: "cstimer" };
}

/* ──────────────────────────────────────────────────────────────────────────
   CubeForge CSV parser
   Format: No.,Time,Penalty,Scramble,Date,Method,Note
   ─────────────────────────────────────────────────────────────────────── */

function parseCubeForgeLine(line: string, _index: number): ImportedSolve | null {
  const fields = splitCSVLine(line, ",");
  if (fields.length < 5) return null;

  // Skip header
  const first = unquote(fields[0] ?? "");
  if (first === "No.") return null; // header row

  const timeRaw = unquote(fields[1] ?? "");
  const penaltyRaw = unquote(fields[2] ?? "");
  const scramble = unquote(fields[3] ?? "");
  const dateRaw = unquote(fields[4] ?? "");
  const methodRaw = fields.length > 5 ? unquote(fields[5] ?? "") : "";
  const note = fields.length > 6 ? unquote(fields[6] ?? "") : "";

  // Time can be "DNF" (string) or "12.34" (seconds with decimal)
  let timeMs: number;
  let penalty: Penalty = "none";

  if (timeRaw.toUpperCase() === "DNF") {
    timeMs = 0;
    penalty = "DNF";
  } else {
    // Try parsing as seconds (e.g. "12.34") or milliseconds
    const secs = parseFloat(timeRaw);
    if (isNaN(secs) || secs < 0) return null;
    // If value is huge (> 1000), treat as milliseconds
    timeMs = secs > 1000 ? Math.round(secs) : Math.round(secs * 1000);
  }

  // Merge penalty from dedicated column if present
  const colPenalty = normalizePenalty(penaltyRaw);
  if (colPenalty !== "none") penalty = colPenalty;

  const timestamp = Date.parse(dateRaw);
  const ts = !isNaN(timestamp) ? timestamp : Date.now();

  const method = methodRaw && isSolveMethod(methodRaw) ? (methodRaw as SolveMethod) : undefined;

  return {
    time: timeMs,
    penalty,
    scramble: scramble || "",
    timestamp: ts,
    method,
    note: note || undefined,
    puzzleType: inferPuzzleType(scramble || ""),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Generic CSV parser (auto-detect columns)
   ─────────────────────────────────────────────────────────────────────── */

function parseGenericCSV(content: string): ImportResult {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    return { solves: [], errors: [], format: "generic-csv" };
  }

  const delimiter = lines[0]!.includes("\t") ? "\t" : ",";
  const headers = splitCSVLine(lines[0]!, delimiter).map((h) => unquote(h).toLowerCase().trim());

  // Map column indices
  const colMap = mapColumns(headers);

  const solves: ImportedSolve[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const fields = splitCSVLine(line, delimiter);
    const solve = parseGenericLine(fields, colMap, i + 1);
    if (solve) {
      solves.push(solve);
    } else {
      errors.push({ line: i + 1, message: "Could not parse time value" });
    }
  }

  return { solves, errors, format: "generic-csv" };
}

interface ColumnMap {
  time: number;
  penalty: number;
  scramble: number;
  date: number;
  note: number;
  method: number;
}

function mapColumns(headers: string[]): ColumnMap {
  const find = (patterns: string[]): number => {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  return {
    time: find(["time", "millis", "ms", "duration", "seconds", "sec"]),
    penalty: find(["penalty", "punishment"]),
    scramble: find(["scramble", "moves", "sequence"]),
    date: find(["date", "timestamp", "time", "when", "created"]),
    note: find(["note", "comment", "notes", "description"]),
    method: find(["method", "type"]),
  };
}

function parseGenericLine(
  fields: string[],
  col: ColumnMap,
  _lineNum: number,
): ImportedSolve | null {
  const get = (idx: number): string =>
    idx >= 0 && idx < fields.length ? unquote(fields[idx] ?? "") : "";

  const timeRaw = get(col.time);
  if (!timeRaw) return null;

  let timeMs: number;
  let penalty: Penalty = "none";

  if (timeRaw.toUpperCase() === "DNF") {
    timeMs = 0;
    penalty = "DNF";
  } else {
    const val = parseFloat(timeRaw);
    if (isNaN(val) || val < 0) return null;
    timeMs = val > 1000 ? Math.round(val) : Math.round(val * 1000);
  }

  const penaltyRaw = get(col.penalty);
  if (penaltyRaw) {
    const p = normalizePenalty(penaltyRaw);
    if (p !== "none") penalty = p;
  }

  const dateRaw = get(col.date);
  let timestamp = Date.now();
  if (dateRaw) {
    const d = parseInt(dateRaw, 10);
    if (!isNaN(d) && d > 0) {
      timestamp = d;
    } else {
      const parsed = Date.parse(dateRaw);
      if (!isNaN(parsed)) timestamp = parsed;
    }
  }

  const methodRaw = get(col.method);
  const method = methodRaw && isSolveMethod(methodRaw) ? (methodRaw as SolveMethod) : undefined;

  return {
    time: timeMs,
    penalty,
    scramble: get(col.scramble) || "",
    timestamp,
    method,
    note: get(col.note) || undefined,
    puzzleType: inferPuzzleType(get(col.scramble) || ""),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   csTimer JSON import (native export format)
   Format: {"session1":[[[penalty,timeMs],scramble,comment,timestamp],...],
            "session2":[...],...,"properties":{...}}
   - penalty: 0 = none, 1 or 2000 = +2, 2 or -1 = DNF
   - timeMs is in milliseconds (raw time without penalty)
   - properties contains session metadata + settings
   ─────────────────────────────────────────────────────────────────────── */

interface CsTimerJsonExport {
  [key: string]: unknown;
}

function parseCsTimerJson(content: string): ImportResult {
  try {
    const data: CsTimerJsonExport = JSON.parse(content);
    const solves: ImportedSolve[] = [];
    const errors: { line: number; message: string }[] = [];

    // Parse session metadata if available from properties.sessionData
    const sessionPuzzleMap: Record<string, string> = {};
    if (typeof data.properties === "object" && data.properties !== null) {
      const props = data.properties as Record<string, unknown>;
      if (typeof props.sessionData === "string") {
        try {
          const sData = JSON.parse(props.sessionData);
          if (typeof sData === "object" && sData !== null) {
            for (const sId of Object.keys(sData)) {
              const sObj = (sData as Record<string, unknown>)[sId];
              if (
                typeof sObj === "object" &&
                sObj !== null &&
                typeof (sObj as Record<string, unknown>).opt === "object" &&
                (sObj as Record<string, unknown>).opt !== null
              ) {
                const opt = (sObj as Record<string, unknown>).opt as Record<string, unknown>;
                const scrType = String(opt.scrType || "");
                if (scrType) {
                  const mapped = mapPuzzleCode(scrType);
                  if (mapped) sessionPuzzleMap[`session${sId}`] = mapped;
                }
              }
            }
          }
        } catch {
          // ignore sessionData parse error
        }
      }
    }

    const sessionKeys = Object.keys(data).filter((k) => /^session\d+$/.test(k));

    // Sort session keys numerically so order is preserved
    sessionKeys.sort((a, b) => {
      const na = parseInt(a.replace("session", ""), 10);
      const nb = parseInt(b.replace("session", ""), 10);
      return na - nb;
    });

    for (const key of sessionKeys) {
      const sessionData = data[key];
      if (!Array.isArray(sessionData)) continue;

      const sessionPuzzle = sessionPuzzleMap[key];

      for (let i = 0; i < sessionData.length; i++) {
        const entry = sessionData[i];
        if (!Array.isArray(entry) || entry.length < 2) {
          errors.push({ line: 0, message: `Invalid entry in ${key}[${i}]` });
          continue;
        }

        const meta = entry[0];
        if (!Array.isArray(meta) || meta.length < 2) {
          errors.push({ line: 0, message: `Invalid solve tuple in ${key}[${i}]` });
          continue;
        }

        const penaltyNum = Number(meta[0]) || 0;
        const timeMs = Number(meta[1]);

        if (isNaN(timeMs) || timeMs < 0) {
          errors.push({ line: 0, message: `Invalid time in ${key}[${i}]` });
          continue;
        }

        const scramble = String(entry[1] ?? "");
        const comment = String(entry[2] ?? "");
        // csTimer timestamps are in seconds (epoch), convert to milliseconds
        const tsRaw = typeof entry[3] === "number" ? entry[3] : 0;
        const timestamp = tsRaw > 0 ? tsRaw * 1000 : Date.now();

        const penalty = mapCsTimerPenaltyNumber(penaltyNum);

        solves.push({
          time: timeMs,
          penalty,
          scramble,
          timestamp,
          note: comment || undefined,
          puzzle: sessionPuzzle || "333",
          category: "Normal",
          puzzleType: sessionPuzzle ?? inferPuzzleType(scramble),
        });
      }
    }

    return { solves, errors, format: "cstimer-json" };
  } catch (e) {
    return {
      solves: [],
      errors: [{ line: 0, message: `Invalid csTimer JSON: ${e instanceof Error ? e.message : String(e)}` }],
      format: "cstimer-json",
    };
  }
}

function mapCsTimerPenaltyNumber(n: number): Penalty {
  // csTimer: 0 = none, 1 = +2, 2 = DNF
  if (n === 2 || n === -1) return "DNF";
  if (n === 1 || n === 2000) return "+2";
  return "none";
}

/* ──────────────────────────────────────────────────────────────────────────
   JSON import (CubeForge format)
   ─────────────────────────────────────────────────────────────────────── */

interface CubeForgeExport {
  exportedAt: string;
  app: string;
  sessionName: string;
  solveCount: number;
  solves: Array<{
    timeMs: number;
    penalty: string;
    scramble: string;
    timestamp: number;
    method?: string;
    note?: string;
    source?: string;
    puzzleType?: string;
    moves?: CubeMoveEvent[];
    analysis?: SolveMetrics;
    orientationTimeline?: OrientationTimeline;
  }>;
}

interface CubeForgeAllExport {
  exportedAt: string;
  app: string;
  sessionCount: number;
  sessions: Array<{
    sessionName: string;
    solveCount: number;
    solves: Array<{
      timeMs: number;
      penalty: string;
      scramble: string;
      timestamp: number;
      method?: string;
      note?: string;
      source?: string;
      puzzleType?: string;
      moves?: CubeMoveEvent[];
      analysis?: SolveMetrics;
      orientationTimeline?: OrientationTimeline;
    }>;
  }>;
}

function toImportedSolve(s: CubeForgeExport["solves"][number]): ImportedSolve {
  return {
    time: s.timeMs,
    penalty: normalizePenalty(s.penalty),
    scramble: s.scramble ?? "",
    timestamp: s.timestamp ?? Date.now(),
    method: s.method && isSolveMethod(s.method) ? (s.method as SolveMethod) : undefined,
    note: s.note,
    puzzleType: normalizePuzzleType(s.puzzleType ?? inferPuzzleType(s.scramble ?? "")),
    moves: s.moves,
    analysis: s.analysis,
    orientationTimeline: s.orientationTimeline,
    source:
      s.source === "smart" || s.source === "manual" || s.source === "virtual"
        ? s.source
        : undefined,
  };
}

function parseJsonImport(content: string): ImportResult {
  try {
    const data = JSON.parse(content);

    // Detect CubeForge JSON
    if (data.app === "CubeForge") {
      // Single-session export: { app, sessionName, solves }
      if (Array.isArray(data.solves)) {
        const export_ = data as CubeForgeExport;
        const solves: ImportedSolve[] = export_.solves.map(toImportedSolve);
        return { solves, errors: [], format: "cubeforge-json" };
      }

      // Full export: { app, sessions: [{ sessionName, solves }] } — flattens
      // every session's solves, preserving each solve's per-solve metadata.
      if (Array.isArray(data.sessions)) {
        const export_ = data as CubeForgeAllExport;
        const solves: ImportedSolve[] = [];
        for (const session of export_.sessions) {
          if (!Array.isArray(session.solves)) continue;
          for (const s of session.solves) solves.push(toImportedSolve(s));
        }
        return { solves, errors: [], format: "cubeforge-json" };
      }
    }

    return { solves: [], errors: [{ line: 0, message: "Unrecognized JSON structure" }], format: "unknown" };
  } catch (e) {
    return {
      solves: [],
      errors: [{ line: 0, message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` }],
      format: "unknown",
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Main import function
   ─────────────────────────────────────────────────────────────────────── */

/**
 * Parse imported content into solve data.
 *
 * Supports:
 * - csTimer semicolon CSV
 * - CubeForge CSV
 * - CubeForge JSON
 * - Generic CSV/Tab-delimited with auto-column detection
 */
export function parseImport(content: string): ImportResult {
  const format = detectFormat(content);

  switch (format) {
    case "cstimer": {
      const lines = content.trim().split("\n");
      const firstLine = lines[0]?.trim() ?? "";
      // Newer csTimer exports use a header row: `No.;Time;Comment;Scramble;Date;P.1`
      if (CSTIMER_HEADER_RE.test(firstLine)) {
        return parseCsTimerHeaderCsv(content);
      }

      const solves: ImportedSolve[] = [];
      const errors: { line: number; message: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;
        // Skip header-like lines
        if (line.startsWith('"Puzzle"') || line.startsWith("Puzzle")) continue;

        const solve = parseCsTimerLine(line, i + 1);
        if (solve) {
          solves.push(solve);
        } else {
          errors.push({ line: i + 1, message: "Could not parse line" });
        }
      }
      return { solves, errors, format };
    }

    case "cubeforge-csv": {
      const lines = content.trim().split("\n");
      const solves: ImportedSolve[] = [];
      const errors: { line: number; message: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;
        const solve = parseCubeForgeLine(line, i + 1);
        if (solve) {
          solves.push(solve);
        } else if (i > 0) {
          // Line 0 is header
          errors.push({ line: i + 1, message: "Could not parse line" });
        }
      }
      return { solves, errors, format };
    }

    case "cstimer-json":
      return parseCsTimerJson(content);

    case "twistytimer":
      return parseTwistyTimerCsv(content);

    case "cubeforge-json":
      return parseJsonImport(content);

    case "generic-csv":
      return parseGenericCSV(content);

    default:
      return { solves: [], errors: [{ line: 0, message: "Could not detect file format. Supported: csTimer CSV, Twisty Timer CSV, CubeForge CSV/JSON, generic CSV/TSV." }], format };
  }
}

/**
 * Generate a preview from imported content (max 5 rows).
 */
export function previewImport(content: string): ImportPreview {
  const format = detectFormat(content);
  const lines = content.trim().split("\n");

  // Determine headers
  let headers: string[] = [];
  if (format === "generic-csv") {
    const delim = lines[0]?.includes("\t") ? "\t" : ",";
    headers = splitCSVLine(lines[0] ?? "", delim).map((h) => unquote(h));
  } else if (format === "twistytimer") {
    headers = ["Time", "Scramble", "Date"];
  } else if (format === "cstimer" || format === "cstimer-json") {
    headers = ["Puzzle", "Category", "Time (ms)", "Date (epoch)", "Scramble", "Penalty", "Comment"];
    // Newer header-based csTimer CSV — show the real column names
    if (format === "cstimer" && CSTIMER_HEADER_RE.test(lines[0]?.trim() ?? "")) {
      headers = splitCSVLine(lines[0] ?? "", ";").map((h) => unquote(h));
    }
  } else if (format === "cubeforge-csv") {
    headers = ["No.", "Time", "Penalty", "Scramble", "Date", "Method", "Note"];
  }

  const result = parseImport(content);
  const samples = result.solves.slice(0, 5);

  return {
    format,
    rowCount: result.solves.length,
    errorCount: result.errors.length,
    samples,
    headers,
    rawLines: lines.slice(0, format === "generic-csv" ? 6 : 5),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

/**
 * Reverse of `sanitizeFormula` in exportSolves.ts: when exporting, text cells
 * that start with `=`, `+`, `-`, `@`, tab or CR get prefixed with a single `'`
 * so spreadsheet apps don't execute them as formulas. When re-importing one of
 * our own exports, strip that marker again so the note round-trips cleanly.
 * Legitimate apostrophe-first text (e.g. `'til later`) is left untouched.
 */
function unescapeFormulaMarker(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function isSolveMethod(s: string): s is SolveMethod {
  return ["CFOP", "Roux", "ZZ", "Petrus"].includes(s as SolveMethod);
}

/** True when a field looks like a column header (e.g. "Time", "Scramble"). */
function looksLikeHeaderField(value: string): boolean {
  return /^(time|scramble|date|comment|penalty|no\.?)$/i.test(value);
}

/**
 * Read a File as text.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Map an ImportedSolve to the shape expected by addSolve.
 */
export function toSolveInput(
  imported: ImportedSolve,
): {
  time: number;
  penalty: Penalty;
  scramble: string;
  method?: SolveMethod;
  timestamp: number;
  note?: string;
  puzzleType?: string;
  source: SolveSource;
  moves?: CubeMoveEvent[];
  analysis?: SolveMetrics;
  orientationTimeline?: OrientationTimeline;
} {
  const puzzleType = normalizePuzzleType(
    imported.puzzleType ?? inferPuzzleType(imported.scramble),
  );
  return {
    time: imported.time,
    penalty: imported.penalty,
    scramble: imported.scramble,
    // Foreign exports (csTimer, Twisty Timer) happily carry a method on 2×2
    // rows: the same rule as the live writers applies here, or the bug comes
    // back through the import door.
    method: imported.method ? methodForEvent(puzzleType, imported.method) : undefined,
    timestamp: imported.timestamp,
    note: unescapeFormulaMarker(imported.note),
    puzzleType,
    source: imported.source ?? "manual",
    moves: imported.moves,
    analysis: imported.analysis,
    orientationTimeline: imported.orientationTimeline,
  };
}
