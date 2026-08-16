import { averageOf, effectiveTime, type StatSolve, type Penalty } from "@cubeforge/statistics";

export interface PbMilestoneResult {
  isSinglePB: boolean;
  isAo5PB: boolean;
  isAo12PB: boolean;
  types: ("Single" | "Ao5" | "Ao12")[];
  singleTime: number | null;
  ao5Time: number | null;
  ao12Time: number | null;
  prevSingleTime: number | null;
  prevAo5Time: number | null;
  prevAo12Time: number | null;
}

/**
 * Minimal solve interface for PB calculation.
 * Supports solves with either `time` or `timeMs`.
 */
export interface MinimalSolve {
  time?: number;
  timeMs?: number;
  penalty?: Penalty | string;
  puzzleType?: string;
}

function toStatSolve(s: MinimalSolve): StatSolve {
  const solveTime = s.time ?? s.timeMs ?? 0;
  const penaltyStr = (s.penalty ?? "none").toString();
  const penalty: Penalty = penaltyStr === "+2" ? "+2" : penaltyStr === "DNF" ? "DNF" : "none";
  return {
    time: solveTime,
    penalty,
  };
}

/**
 * Computes the best rolling average of N solves in a session (solves ordered newest first).
 */
export function getBestRollingAverage(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null;
  let bestAvg: number | null = null;
  for (let i = 0; i <= solves.length - n; i++) {
    const window = solves.slice(i, i + n);
    const avg = averageOf(window, n);
    if (avg !== null && Number.isFinite(avg)) {
      if (bestAvg === null || avg < bestAvg) {
        bestAvg = avg;
      }
    }
  }
  return bestAvg;
}

/**
 * Detects whether a newly completed solve breaks personal bests (Single, Ao5, Ao12)
 * in the active session.
 *
 * @param existingSolves Solves prior to the new solve (newest first).
 * @param newTimeMs Time of the new solve in ms.
 * @param newPenalty Penalty of the new solve ("none", "+2", "DNF").
 * @param currentPuzzleType Optional puzzle type filter (e.g. '333', '222').
 */
export function detectPbMilestones(
  existingSolves: MinimalSolve[],
  newTimeMs: number,
  newPenalty: Penalty = "none",
  currentPuzzleType?: string,
): PbMilestoneResult {
  const newSolve: StatSolve = { time: newTimeMs, penalty: newPenalty };
  const newEffTime = effectiveTime(newSolve);

  // If the new solve is a DNF, it cannot be a PB.
  if (!Number.isFinite(newEffTime)) {
    return {
      isSinglePB: false,
      isAo5PB: false,
      isAo12PB: false,
      types: [],
      singleTime: null,
      ao5Time: null,
      ao12Time: null,
      prevSingleTime: null,
      prevAo5Time: null,
      prevAo12Time: null,
    };
  }

  const filteredExisting = currentPuzzleType
    ? existingSolves.filter((s) => (s.puzzleType ?? "333") === currentPuzzleType)
    : existingSolves;

  const existingStatSolves = filteredExisting.map(toStatSolve);

  // 1. Single PB check
  const validExistingSingles = existingStatSolves
    .map(effectiveTime)
    .filter((t) => Number.isFinite(t));

  const prevBestSingle =
    validExistingSingles.length > 0 ? Math.min(...validExistingSingles) : null;

  // Single PB triggers when there are no previous valid solves or when new time strictly beats previous best single
  const isSinglePB = prevBestSingle === null ? true : newEffTime < prevBestSingle;

  // 2. Combine solves with new solve at the front (newest first)
  const updatedStatSolves = [newSolve, ...existingStatSolves];

  // 3. Ao5 PB check
  const prevBestAo5 = getBestRollingAverage(existingStatSolves, 5);
  const newAo5 = averageOf(updatedStatSolves, 5);
  const validNewAo5 = newAo5 !== null && Number.isFinite(newAo5) ? newAo5 : null;

  const isAo5PB =
    validNewAo5 !== null &&
    (prevBestAo5 === null ? true : validNewAo5 < prevBestAo5);

  // 4. Ao12 PB check
  const prevBestAo12 = getBestRollingAverage(existingStatSolves, 12);
  const newAo12 = averageOf(updatedStatSolves, 12);
  const validNewAo12 = newAo12 !== null && Number.isFinite(newAo12) ? newAo12 : null;

  const isAo12PB =
    validNewAo12 !== null &&
    (prevBestAo12 === null ? true : validNewAo12 < prevBestAo12);

  const types: ("Single" | "Ao5" | "Ao12")[] = [];
  if (isSinglePB) types.push("Single");
  if (isAo5PB) types.push("Ao5");
  if (isAo12PB) types.push("Ao12");

  return {
    isSinglePB,
    isAo5PB,
    isAo12PB,
    types,
    singleTime: isSinglePB ? newEffTime : null,
    ao5Time: isAo5PB ? validNewAo5 : null,
    ao12Time: isAo12PB ? validNewAo12 : null,
    prevSingleTime: prevBestSingle,
    prevAo5Time: prevBestAo5,
    prevAo12Time: prevBestAo12,
  };
}
