"use client";

import type { Penalty, SolveMethod, SolveSource } from "@/types";
import { normalizePenalty } from "@/types";

/* ──────────────────────────────────────────────────────────────────────────
   Import format identifiers
   ─────────────────────────────────────────────────────────────────────── */

export type ImportFormat = "cstimer" | "cubeforge-csv" | "cubeforge-json" | "generic-csv" | "unknown";

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
 * csTimer:     "333";"Normal";"122170";"1620000000000";"R U R' U'...";"0";""
 * CubeForge:   No.,Time,Penalty,Scramble,Date,Method,Note
 * generic CSV: any comma or tab delimited data with a header row
 * JSON:        starts with `{` or `[`
 */
export function detectFormat(content: string): ImportFormat {
  const trimmed = content.trim();

  // JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "cubeforge-json";
    } catch {
      return "unknown";
    }
  }

  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";

  // csTimer: semicolon-delimited with quoted fields
  if (firstLine.includes('";"')) {
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
  };
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
  }>;
}

function parseJsonImport(content: string): ImportResult {
  try {
    const data = JSON.parse(content);

    // Detect CubeForge JSON
    if (data.app === "CubeForge" && Array.isArray(data.solves)) {
      const export_ = data as CubeForgeExport;
      const solves: ImportedSolve[] = export_.solves.map((s) => ({
        time: s.timeMs,
        penalty: normalizePenalty(s.penalty),
        scramble: s.scramble ?? "",
        timestamp: s.timestamp ?? Date.now(),
        method: s.method && isSolveMethod(s.method) ? (s.method as SolveMethod) : undefined,
        note: s.note,
      }));
      return { solves, errors: [], format: "cubeforge-json" };
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

    case "cubeforge-json":
      return parseJsonImport(content);

    case "generic-csv":
      return parseGenericCSV(content);

    default:
      return { solves: [], errors: [{ line: 0, message: "Could not detect file format. Supported: csTimer CSV, CubeForge CSV/JSON, generic CSV/TSV." }], format };
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
  } else if (format === "cstimer") {
    headers = ["Puzzle", "Category", "Time (ms)", "Date (epoch)", "Scramble", "Penalty", "Comment"];
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

function isSolveMethod(s: string): s is SolveMethod {
  return ["CFOP", "Roux", "ZZ", "Petrus"].includes(s as SolveMethod);
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
  method?: string;
  timestamp: number;
  note?: string;
  source: SolveSource;
} {
  return {
    time: imported.time,
    penalty: imported.penalty,
    scramble: imported.scramble,
    method: imported.method,
    timestamp: imported.timestamp,
    note: imported.note,
    source: "manual" as SolveSource,
  };
}
