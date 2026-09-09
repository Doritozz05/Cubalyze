import type { Solve } from '@/types';

/** Fixed demo scramble shown in the theme preview. */
export const DEMO_SCRAMBLE = "R U R' U' R' F R2 U' R' U' R U R' F'";

export const DEMO_SCRAMBLE_INDEX = '#42';

/** Demo session label used by the dock / mobile header clones. */
export const DEMO_SESSION_NAME = 'Sesión 1';

function demoSolve(id: number, timeMs: number): Solve {
  return {
    id: `demo-${id}`,
    time: timeMs,
    penalty: 'none',
    scramble: DEMO_SCRAMBLE,
    timestamp: 1_700_000_000_000 + id * 60_000,
    source: 'manual',
    puzzleType: '333',
  };
}

/**
 * Twelve fixed demo solves (~9–12 s). Twelve is deliberate: Ao12 computes
 * and the BPA/WPA pill falls into the Ao5 branch, exactly like a real
 * mid-session stage.
 */
const DEMO_TIMES = [
  9840, 11203, 10552, 9215, 11780, 10894, 9670, 11435, 10210, 8940, 11056, 10613,
];

export const DEMO_SOLVES: Solve[] = DEMO_TIMES.map((timeMs, i) =>
  demoSolve(i + 1, timeMs),
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
