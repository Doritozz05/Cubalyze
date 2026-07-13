// ─────────────────────────────────────────────────────────────────────────
// Mock data — purely for populating the UI on first load.
// Replace these with outputs from the real `timer-engine`.
// ─────────────────────────────────────────────────────────────────────────

import type { Solve } from "@/types";

/** A handful of plausible 3x3 scrambles (WCA-style notation). */
export const MOCK_SCRAMBLES: string[] = [
  "R U R' U' R' F R2 U' R' U' R U R' F'",
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  "U R2 U R' U R U2 R' U R U2 R' U' R U' R'",
  "R' U' F R U R' U' R' F' R2 U' R' U' R U R' U R",
  "L' U' L U L F' L' F L' U' L U L F' L' F",
  "B2 R2 U R2 U' R2 U' D R2 U' R2 U R2 D'",
  "F2 U' R2 U F2 U' R2 U R2 U' F2 U R2 U'",
  "R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  "U' L' U R U' L U R' U' L' U R U' L U R'",
  "R2 U R2 U R2 U' R2 U' R2 D R2 U' R2 U R2 D'",
];

/** Mock solve history (newest first). Times are in milliseconds. */
export const MOCK_SOLVES: Solve[] = [
  { id: "s-20", time: 18420, penalty: "none", scramble: MOCK_SCRAMBLES[1], timestamp: Date.now() - 1000 * 60 },
  { id: "s-19", time: 17650, penalty: "+2", scramble: MOCK_SCRAMBLES[2], timestamp: Date.now() - 1000 * 60 * 3 },
  { id: "s-18", time: 19230, penalty: "none", scramble: MOCK_SCRAMBLES[3], timestamp: Date.now() - 1000 * 60 * 5 },
  { id: "s-17", time: 16980, penalty: "none", scramble: MOCK_SCRAMBLES[4], timestamp: Date.now() - 1000 * 60 * 7 },
  { id: "s-16", time: 0, penalty: "DNF", scramble: MOCK_SCRAMBLES[5], timestamp: Date.now() - 1000 * 60 * 9 },
  { id: "s-15", time: 18110, penalty: "none", scramble: MOCK_SCRAMBLES[6], timestamp: Date.now() - 1000 * 60 * 11 },
  { id: "s-14", time: 17440, penalty: "none", scramble: MOCK_SCRAMBLES[7], timestamp: Date.now() - 1000 * 60 * 13 },
  { id: "s-13", time: 19990, penalty: "+2", scramble: MOCK_SCRAMBLES[8], timestamp: Date.now() - 1000 * 60 * 15 },
  { id: "s-12", time: 16720, penalty: "none", scramble: MOCK_SCRAMBLES[9], timestamp: Date.now() - 1000 * 60 * 17 },
  { id: "s-11", time: 17880, penalty: "none", scramble: MOCK_SCRAMBLES[0], timestamp: Date.now() - 1000 * 60 * 19 },
  { id: "s-10", time: 18560, penalty: "none", scramble: MOCK_SCRAMBLES[1], timestamp: Date.now() - 1000 * 60 * 21 },
  { id: "s-09", time: 17210, penalty: "none", scramble: MOCK_SCRAMBLES[2], timestamp: Date.now() - 1000 * 60 * 23 },
  { id: "s-08", time: 16450, penalty: "none", scramble: MOCK_SCRAMBLES[3], timestamp: Date.now() - 1000 * 60 * 25 },
  { id: "s-07", time: 19100, penalty: "none", scramble: MOCK_SCRAMBLES[4], timestamp: Date.now() - 1000 * 60 * 27 },
  { id: "s-06", time: 17730, penalty: "+2", scramble: MOCK_SCRAMBLES[5], timestamp: Date.now() - 1000 * 60 * 29 },
  { id: "s-05", time: 16920, penalty: "none", scramble: MOCK_SCRAMBLES[6], timestamp: Date.now() - 1000 * 60 * 31 },
  { id: "s-04", time: 0, penalty: "DNF", scramble: MOCK_SCRAMBLES[7], timestamp: Date.now() - 1000 * 60 * 33 },
  { id: "s-03", time: 18150, penalty: "none", scramble: MOCK_SCRAMBLES[8], timestamp: Date.now() - 1000 * 60 * 35 },
  { id: "s-02", time: 17380, penalty: "none", scramble: MOCK_SCRAMBLES[9], timestamp: Date.now() - 1000 * 60 * 37 },
  { id: "s-01", time: 16610, penalty: "none", scramble: MOCK_SCRAMBLES[0], timestamp: Date.now() - 1000 * 60 * 39 },
];

/** Best-of reference time for the mock session (used in header chip). */
export const MOCK_PB = 16120;
