"use client";

import type { Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";
import type { ExportTagContract } from "@/lib/exportTag";

/**
 * `app` discriminator written into the exported JSON and into the `.xlsx`
 * ``Info`` sheet. `importSolves` accepts the tags earlier releases wrote as
 * well, so a backup downloaded before the rename still imports
 * (see `@/lib/exportTag`).
 */
export const SOLVE_EXPORT_TAGS: ExportTagContract = {
  current: "Cubalyze",
  legacy: ["CubeForge"],
};

/**
 * Neutralize spreadsheet formula injection (OWASP): when a cell is opened in
 * Excel/Sheets, values starting with =, +, -, @, tab or CR are interpreted as
 * formulas. Prefixing with a single quote forces them to be treated as text.
 * Applied to every user-controlled text cell in CSV/XLSX exports.
 */
function sanitizeFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Export solves to the Cubalyze CSV format.
 */
export function exportSolvesToCSV(solves: Solve[], _sessionName?: string): string {
  const header = "No.,Time,Penalty,Scramble,Date,Method,Note";
  const rows = solves.map((solve, i) => {
    const no = solves.length - i;
    const time = normalizePenalty(solve.penalty) === "DNF"
      ? "DNF"
      : formatTime(effectiveTime(solve));
    const date = new Date(solve.timestamp).toISOString();
    const note = solve.note
      ? `"${sanitizeFormula(solve.note).replace(/"/g, '""')}"`
      : "";
    const method = sanitizeFormula(solve.method ?? "");
    const scramble = sanitizeFormula(solve.scramble);
    return [no, time, solve.penalty, `"${scramble}"`, date, method, note].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Format a Date object to csTimer's human-readable timestamp: "YYYY-MM-DD HH:mm:ss"
 */
function formatCsTimerDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/**
 * Export solves in csTimer's official CSV export format.
 *
 * Header: No.;Time;Comment;Scramble;Date;P.1
 * Example lines:
 *   1;1:13.52;;F U2 R2...;2025-01-16 08:49:47;1:13.52
 *   4;46.07+;;D F2 L'...;2025-01-16 11:25:54;44.07
 *   7;DNF(44.83);Hola;U2 F L2...;2026-07-31 13:06:30;44.83
 */
export function exportSolvesToCsTimer(solves: Solve[]): string {
  const header = "No.;Time;Comment;Scramble;Date;P.1";

  const rows = solves.map((solve, i) => {
    const no = i + 1;
    const pen = normalizePenalty(solve.penalty);

    let timeStr: string;
    let p1Str: string;

    if (pen === "DNF") {
      const rawSecs = solve.time > 0 ? (solve.time / 1000).toFixed(2) : "";
      timeStr = rawSecs ? `DNF(${formatTime(solve.time)})` : "DNF";
      p1Str = rawSecs ? formatTime(solve.time) : "DNF";
    } else if (pen === "+2") {
      const eff = effectiveTime(solve);
      timeStr = `${formatTime(eff)}+`;
      p1Str = formatTime(solve.time);
    } else {
      timeStr = formatTime(solve.time);
      p1Str = timeStr;
    }

    const comment = solve.note ? sanitizeFormula(solve.note).replace(/;/g, ",") : "";
    const scramble = sanitizeFormula(solve.scramble).replace(/;/g, "");
    const dateStr = formatCsTimerDate(solve.timestamp);

    return `${no};${timeStr};${comment};${scramble};${dateStr};${p1Str}`;
  });

  return [header, ...rows].join("\n");
}

/**
 * Export solves to JSON format (machine-readable, includes full solve data).
 */
export function exportSolvesToJSON(
  solves: Solve[],
  sessionName: string = 'Unknown',
): string {
  const data = {
    exportedAt: new Date().toISOString(),
    app: SOLVE_EXPORT_TAGS.current,
    sessionName: sessionName ?? "Unknown",
    solveCount: solves.length,
    solves: solves.map((solve) => ({
      timeMs: solve.time,
      penalty: solve.penalty,
      scramble: solve.scramble,
      timestamp: solve.timestamp,
      method: solve.method,
      note: solve.note,
      source: solve.source,
      puzzleType: solve.puzzleType,
      moves: solve.moves,
      analysis: solve.analysis,
      orientationTimeline: solve.orientationTimeline,
    })),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Export EVERY session's solves to a single JSON file (full fidelity).
 *
 * Structure: `{ app, exportedAt, sessions: [{ sessionName, solveCount, solves }] }`.
 * Each solve keeps its full metadata (including per-solve `puzzleType`), so
 * the "Import Cubalyze JSON (no data loss)" flow restores it exactly.
 */
export function exportAllSolvesToJSON(
  sessions: Array<{ sessionName: string; solves: Solve[] }>,
): string {
  const data = {
    exportedAt: new Date().toISOString(),
    app: SOLVE_EXPORT_TAGS.current,
    sessionCount: sessions.length,
    sessions: sessions.map(({ sessionName, solves }) => ({
      sessionName: sessionName ?? "Unknown",
      solveCount: solves.length,
      solves: solves.map((solve) => ({
        timeMs: solve.time,
        penalty: solve.penalty,
        scramble: solve.scramble,
        timestamp: solve.timestamp,
        method: solve.method,
        note: solve.note,
        source: solve.source,
        puzzleType: solve.puzzleType,
        moves: solve.moves,
        analysis: solve.analysis,
        orientationTimeline: solve.orientationTimeline,
      })),
    })),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export solves to a real Excel (.xlsx) workbook via SheetJS.
 *
 * SheetJS is lazily loaded (dynamic import) so the ~900KB library only hits
 * the network/bundle the first time a user actually exports — the main app
 * bundle stays unchanged.
 */
export async function exportSolvesToXLSX(
  solves: Solve[],
  sessionName: string = "session",
): Promise<void> {
  const XLSX = await import("xlsx");

  const rows = solves.map((solve, i) => {
    const pen = normalizePenalty(solve.penalty);
    const eff = effectiveTime(solve);
    const no = solves.length - i;
    return {
      No: no,
      Time: pen === "DNF" ? "DNF" : formatTime(eff),
      "Time (s)": Number.isFinite(eff) ? Number((eff / 1000).toFixed(2)) : "DNF",
      Penalty: solve.penalty,
      Scramble: sanitizeFormula(solve.scramble),
      Date: new Date(solve.timestamp).toISOString(),
      Method: sanitizeFormula(solve.method ?? ""),
      Note: sanitizeFormula(solve.note ?? ""),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // Readable column widths.
  ws["!cols"] = [
    { wch: 5 }, // No
    { wch: 10 }, // Time
    { wch: 10 }, // Time (s)
    { wch: 8 }, // Penalty
    { wch: 60 }, // Scramble
    { wch: 24 }, // Date
    { wch: 8 }, // Method
    { wch: 20 }, // Note
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Solves");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        App: SOLVE_EXPORT_TAGS.current,
        Session: sanitizeFormula(sessionName),
        ExportedAt: new Date().toISOString(),
        SolveCount: solves.length,
      },
    ]),
    "Info",
  );

  XLSX.writeFile(wb, `cubeforge-${sanitizeFilename(sessionName)}.xlsx`);
}

/** Keep session names filesystem-safe for downloads. */
function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^a-z0-9_-]/gi, "_");
  return safe.length > 0 ? safe : "session";
}
