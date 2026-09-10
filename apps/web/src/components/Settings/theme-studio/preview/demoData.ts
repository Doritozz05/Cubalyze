import type { Solve } from '@/types';

/** Fixed 3×3 demo scramble (full-face turns so the 2D net renders 3×3). */
export const DEMO_SCRAMBLE_333 =
  "D2 L' F2 U' B2 R2 D B2 D' F2 U' B' L2 R2 D' F' U2 R'";

/** Fixed 2×2 demo scramble (short URF-only so the 2D net renders 2×2). */
export const DEMO_SCRAMBLE_222 = "R U' R' U F' U F R2 U2";

export const DEMO_SCRAMBLE_INDEX = '#42';

/** Demo session label used by the dock / mobile header clones. */
export const DEMO_SESSION_NAME = 'Sesión 1';

function demoSolve(
  id: number,
  timeMs: number,
  puzzleType: string,
  scramble: string,
): Solve {
  return {
    id: `demo-${puzzleType}-${id}`,
    time: timeMs,
    penalty: 'none',
    scramble,
    timestamp: 1_700_000_000_000 + id * 60_000,
    source: 'manual',
    puzzleType,
  };
}

/**
 * Twelve fixed 3×3 demo solves (~9–12 s). Twelve is deliberate: Ao12 computes
 * and the BPA/WPA stats fall into the Ao5 branch, exactly like a real
 * mid-session stage. These stay the NEWEST solves of the 333 demo set.
 */
const DEMO_TIMES_333_TAIL = [
  9840, 11203, 10552, 9215, 11780, 10894, 9670, 11435, 10210, 8940, 11056, 10613,
];

/** Deterministic older 3×3 history (~9–13 s) so Ao50/Ao100 also compute. */
const DEMO_TIMES_333_HEAD = Array.from(
  { length: 108 },
  (_, i) => 9000 + ((i * 7919) % 4000),
);

/** Full 3×3 demo session: oldest first in the array tail, newest at index 0. */
export const DEMO_SOLVES_333: Solve[] = [
  ...DEMO_TIMES_333_TAIL,
  ...DEMO_TIMES_333_HEAD,
].map((timeMs, i) => demoSolve(i + 1, timeMs, '333', DEMO_SCRAMBLE_333));

/** Twelve fixed 2×2 demo solves (~2.8–5.5 s). */
const DEMO_TIMES_222 = [
  3240, 4103, 3652, 2915, 5080, 4494, 3370, 5235, 3810, 3040, 4656, 3913,
];

export const DEMO_SOLVES_222: Solve[] = DEMO_TIMES_222.map((timeMs, i) =>
  demoSolve(i + 1, timeMs, '222', DEMO_SCRAMBLE_222),
);

/** Last-solve time shown on the idle timer face. */
export const DEMO_LAST_TIME_MS = 9840;

/** PB used for the idle delta tag: 9840 − 10260 = −420 ms → "−0.42". */
export const DEMO_PB_MS = 10260;

/** Inspection face shows this remaining second. */
export const DEMO_INSPECTION_REMAINING_MS = 3000;

/** Running face time. */
export const DEMO_RUNNING_MS = 6420;

/** Penalty face: last solve +2 → "11.85+". */
export const DEMO_PENALTY_LAST_MS = 11850;
