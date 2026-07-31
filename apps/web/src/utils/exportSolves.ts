"use client";

import type { Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";

/**
 * Export solves to CubeForge CSV format.
 */
export function exportSolvesToCSV(solves: Solve[], _sessionName?: string): string {
  const header = "No.,Time,Penalty,Scramble,Date,Method,Note";
  const rows = solves.map((solve, i) => {
    const no = solves.length - i;
    const time = normalizePenalty(solve.penalty) === "DNF"
      ? "DNF"
      : formatTime(effectiveTime(solve));
    const date = new Date(solve.timestamp).toISOString();
    const note = solve.note ? `"${solve.note.replace(/"/g, '""')}"` : "";
    const method = solve.method ?? "";
    return [no, time, solve.penalty, `"${solve.scramble}"`, date, method, note].join(",");
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

    const comment = solve.note ? solve.note.replace(/;/g, ",") : "";
    const scramble = solve.scramble.replace(/;/g, "");
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
    app: "CubeForge",
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
