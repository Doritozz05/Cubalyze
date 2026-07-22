import { PLL_CASES } from './cfop-pll';
import type { AlgorithmCase, Algorithm } from '../schema';

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

  // Future: CFOP → OLL, CFOP → F2L, Roux → CMLL, etc.

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
