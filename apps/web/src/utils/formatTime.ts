// ─────────────────────────────────────────────────────────────────────────
// Time formatting helpers.
// All formatting targets centisecond precision (mm:ss.cs) so the monospaced
// timer never "jumps" width while counting.
//
// Statistics functions (averageOf, computeStats, computeBpaWpa) are now in
// the headless @cubeforge/statistics package; computeStats/computeBpaWpa are
// re-exported here for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────

// Re-export statistics functions for backward compatibility.
export { computeStats, computeBpaWpa, averageOf } from "@cubeforge/statistics";

const INF = Number.POSITIVE_INFINITY;

/**
 * Format milliseconds as a monospaced-friendly string.
 *  - centiseconds: < 60s -> "12.34", >= 60s -> "1:23.45"
 *  - milliseconds: < 60s -> "12.345", >= 60s -> "1:23.456"
 *  - DNF -> "DNF"
 */
export function formatTime(
  ms: number,
  precision: "centiseconds" | "milliseconds" = "centiseconds"
): string {
  if (ms === INF || !Number.isFinite(ms)) return "DNF";
  if (ms < 0 || Number.isNaN(ms)) return precision === "milliseconds" ? "0.000" : "0.00";

  if (precision === "milliseconds") {
    const totalMs = Math.floor(ms);
    const millis = totalMs % 1000;
    const totalSeconds = Math.floor(totalMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);

    const msStr = millis.toString().padStart(3, "0");
    const secStr = seconds.toString().padStart(2, "0");

    if (minutes > 0) return `${minutes}:${secStr}.${msStr}`;
    return `${seconds}.${msStr}`;
  }

  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const csStr = cs.toString().padStart(2, "0");
  const secStr = seconds.toString().padStart(2, "0");

  if (minutes > 0) return `${minutes}:${secStr}.${csStr}`;
  return `${seconds}.${csStr}`;
}

/** Compact session duration, e.g. "12m 04s" or "1h 05m". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** Short label for a stat value, handling DNF/null gracefully. */
export function statLabel(value: number | null): string {
  if (value === null) return "—";
  return formatTime(value);
}
