import { PLL_CASES } from './cfop-pll';
import { OLL_CASES } from './cfop-oll';
import { ALL_F2L_CASES, BASIC_F2L_CASES, ADVANCED_F2L_CASES } from './cfop-f2l';
import type { AlgorithmCase, Algorithm } from '../schema';

export { BASIC_F2L_CASES, ADVANCED_F2L_CASES, ALL_F2L_CASES };

/** All seed cases from all methods/subsets. */
export interface SeedData {
  cases: AlgorithmCase[];
  algorithms: Algorithm[];
}

/** Collect all seed data into a unified format. */
export function getSeedData(): SeedData {
  const cases: AlgorithmCase[] = [];
  const algorithms: Algorithm[] = [];

  // ─── CFOP → PLL ────────────────────────────────────────────────────
  for (const pll of PLL_CASES) {
    cases.push(pll.caseDef);
    for (const a of pll.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── CFOP → OLL ────────────────────────────────────────────────────
  for (const oll of OLL_CASES) {
    cases.push(oll.caseDef);
    for (const a of oll.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── CFOP → F2L (Basic & Advanced) ───────────────────────────────────
  for (const f2l of ALL_F2L_CASES) {
    cases.push(f2l.caseDef);
    for (const a of f2l.algorithms) {
      algorithms.push(a);
    }
  }

  return { cases, algorithms };
}

/** Check if the database already has been seeded. */
export async function isSeeded(algorithmsRepo: { count(): Promise<number> }): Promise<boolean> {
  const count = await algorithmsRepo.count();
  return count > 0;
}

/**
 * Seed the database if empty.
 *
 * The algorithmsRepo must implement count(), insertCase(), and insertAlgorithm().
 * If the repo doesn't support the new schema yet, the seed data can still be
 * used in-memory via `getSeedData()` directly (as PracticeDashboard does).
 */
export async function seedIfEmpty(
  algorithmsRepo: {
    count(): Promise<number>;
    insertCase?(c: AlgorithmCase): Promise<void>;
    insertAlgorithm?(a: Algorithm): Promise<void>;
  },
): Promise<number> {
  if (await isSeeded(algorithmsRepo)) return 0;

  if (!algorithmsRepo.insertCase || !algorithmsRepo.insertAlgorithm) {
    // Repo doesn't support the new schema yet — skip DB seeding
    // The app will use in-memory data via getSeedData()
    return 0;
  }

  const { cases, algorithms } = getSeedData();
  let seeded = 0;

  for (const c of cases) {
    await algorithmsRepo.insertCase(c);
    seeded++;
  }
  for (const a of algorithms) {
    await algorithmsRepo.insertAlgorithm(a);
    seeded++;
  }

  return seeded;
}
