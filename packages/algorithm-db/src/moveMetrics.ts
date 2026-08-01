/**
 * Shared move-count metric computation for algorithm notation.
 *
 * Extracted from cfop-pll.ts, cfop-oll.ts, cfop-f2l.ts, and ortega.ts
 * to eliminate the 4-copy duplication. All seed files and the
 * AlgorithmEditorDialog import from here.
 */

export type MoveMetric = "htm" | "qtm" | "stm";

export interface MoveCountResult {
  htm: number;
  qtm: number;
  stm: number;
}

/**
 * Compute HTM, QTM, and STM metrics from a move-token array.
 * Uses the original raw notation (pre-expansion for wide moves) so
 * that wide moves like `r` count as 1 HTM, not 2.
 *
 * @param moves - Array of move tokens (e.g. ["R", "U", "R'", "U2"])
 */
export function computeMoveMetricsFromTokens(moves: string[]): MoveCountResult {
  let htm = 0;
  let qtm = 0;
  let stm = 0;

  for (let t of moves) {
    t = t.replace(/[()]/g, "").replace(/2'/g, "2");
    const base = t[0] ?? "";
    const isRotation = base === "x" || base === "y" || base === "z";
    // STM: every non-rotation token = 1
    if (!isRotation) stm++;

    // HTM: every non-rotation token = 1 (including slices)
    if (!isRotation) htm++;

    // QTM: half-turns = 2, everything else = 1
    if (!isRotation) {
      qtm += t.includes("2") ? 2 : 1;
    }
  }

  return { htm, qtm, stm };
}

/**
 * Compute HTM, QTM, and STM metrics from a raw string (e.g., "R U R' U2").
 * Widely used by seed files (cfop-pll, cfop-oll, cfop-f2l, ortega).
 *
 * Uses the ORIGINAL string notation (before expansion into face + slice
 * tokens). Counting from the original representation avoids
 * double-counting wide moves — a wide move like `r` counts as 1 HTM,
 * whereas its expansion `R M'` would naively count as 2.
 */
export function computeMoveMetricsFromString(
  movesStr: string,
): MoveCountResult {
  const tokens = movesStr.trim().split(/\s+/).filter(Boolean);
  return computeMoveMetricsFromTokens(tokens);
}
