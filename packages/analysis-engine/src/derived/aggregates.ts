/**
 * Aggregate statistics — averages over sessions.
 *
 * Pure functions. Framework-agnostic, zero UI dependencies.
 */

import { effectiveTime } from "@cubeforge/statistics";
import type { StatSolve } from "@cubeforge/statistics";

/**
 * Session average effective time (excluding DNFs).
 * Returns null when there are no valid solves.
 */
export function deriveAvgTime(solves: StatSolve[]): number | null {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
