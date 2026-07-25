"use client";

import type { Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";

/**
 * Export solves to CSV format.
 * Compatible with csTimer / Twisty Timer import.
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
