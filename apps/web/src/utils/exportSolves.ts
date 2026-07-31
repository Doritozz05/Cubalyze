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
 * Export solves in csTimer-compatible format (semicolon-delimited, quoted).
 *
 * csTimer format:
 *   "Puzzle";"Category";"Time(millis)";"Date(epoch)";"Scramble";"Penalty";"Comment"
 *
 * This format is natively importable by csTimer via "Import session(s) from
 * other timers" and by Twisty Timer / other speedcubing apps.
 */
export function exportSolvesToCsTimer(solves: Solve[]): string {
  const header = '"Puzzle";"Category";"Time(millis)";"Date(epoch)";"Scramble";"Penalty";"Comment"';

  const rows = solves.map((solve) => {
    const puzzle = puzzleCodeFromType(solve.puzzleType);
    const category = "Normal";
    const timeMs = normalizePenalty(solve.penalty) === "DNF"
      ? "-1" // csTimer DNF sentinel
      : String(solve.time);
    const dateEpoch = String(solve.timestamp);
    const scramble = escapeQuoted(solve.scramble);
    const penalty = normalizePenalty(solve.penalty) === "+2"
      ? "2000"
      : normalizePenalty(solve.penalty) === "DNF"
        ? "-1"
        : "0";
    const comment = solve.note ? escapeQuoted(solve.note) : "";

    return `"${puzzle}";"${category}";"${timeMs}";"${dateEpoch}";"${scramble}";"${penalty}";"${comment}"`;
  });

  return [header, ...rows].join("\n");
}

/**
 * Escape a string for csTimer CSV: wrap in quotes, escape internal quotes.
 */
function escapeQuoted(s: string): string {
  return s.replace(/"/g, '""');
}

/** Map a CubeForge puzzle type ("3x3x3") to a csTimer puzzle code ("333"). */
function puzzleCodeFromType(puzzleType?: string): string {
  switch (puzzleType) {
    case "2x2x2": return "222";
    case "4x4x4": return "444";
    case "5x5x5": return "555";
    case "6x6x6": return "666";
    case "7x7x7": return "777";
    default: return "333";
  }
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
