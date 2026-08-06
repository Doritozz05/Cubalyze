import { PLL_CASES } from './cfop-pll';
import { OLL_CASES } from './cfop-oll';
import { ALL_F2L_CASES, BASIC_F2L_CASES, ADVANCED_F2L_CASES } from './cfop-f2l';
import { ORTEGA_OLL_CASES, ORTEGA_PBL_CASES } from './ortega';
import { COLL_CASES } from './coll';
import { WV_CASES } from './wv';
import type { AlgorithmCase, Algorithm } from '../schema';
import { METHODS, SUBSETS } from '../methodRegistry';

export { BASIC_F2L_CASES, ADVANCED_F2L_CASES, ALL_F2L_CASES };
export { ORTEGA_OLL_CASES, ORTEGA_PBL_CASES };
export { COLL_CASES, WV_CASES };

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

  // ─── CFOP → F2L (Basic & Advanced) ─────────────────────────────────
  for (const f2l of ALL_F2L_CASES) {
    cases.push(f2l.caseDef);
    for (const a of f2l.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── 2×2: Ortega OLL ───────────────────────────────────────────────
  for (const oll of ORTEGA_OLL_CASES) {
    cases.push(oll.caseDef);
    for (const a of oll.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── 2×2: Ortega PBL ───────────────────────────────────────────────
  for (const pbl of ORTEGA_PBL_CASES) {
    cases.push(pbl.caseDef);
    for (const a of pbl.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── CFOP → COLL (generated from SCDB) ─────────────────────────────
  for (const coll of COLL_CASES) {
    cases.push(coll.caseDef);
    for (const a of coll.algorithms) {
      algorithms.push(a);
    }
  }

  // ─── CFOP → Winter Variation (generated from SCDB) ─────────────────
  for (const wv of WV_CASES) {
    cases.push(wv.caseDef);
    for (const a of wv.algorithms) {
      algorithms.push(a);
    }
  }

  return { cases, algorithms };
}

/** Check if the database already has been seeded. */
export async function isSeeded(algorithmsRepo: { countCases(): Promise<number> }): Promise<boolean> {
  const count = await algorithmsRepo.countCases();
  return count > 0;
}

/**
 * Seed the database if empty.
 *
 * The algorithmsRepo must implement the canonical catalog inserts. If it does
 * not support the new schema yet, the seed data can still be used in-memory
 * via `getSeedData()` directly.
 */
export async function seedIfEmpty(
  algorithmsRepo: {
    countCases(): Promise<number>;
    insertMethod?(method: (typeof METHODS)[number]): Promise<void>;
    insertSubset?(subset: (typeof SUBSETS)[number]): Promise<void>;
    insertCase?(c: AlgorithmCase): Promise<void>;
    insertAlgorithm?(a: Algorithm): Promise<void>;
    /** Bulk path: seed the whole catalog in a handful of statements. */
    seedAll?(data: {
      methods: (typeof METHODS)[number][];
      subsets: (typeof SUBSETS)[number][];
      cases: AlgorithmCase[];
      algorithms: Algorithm[];
    }): Promise<number>;
  },
): Promise<number> {
  // The old count-only fast path was unsafe: a partially seeded database could
  // have cases but no methods/subsets, making every INNER JOIN return zero.
  // Always reconcile the canonical catalog; repository inserts are idempotent.
  if (!algorithmsRepo.insertMethod || !algorithmsRepo.insertSubset ||
      !algorithmsRepo.insertCase || !algorithmsRepo.insertAlgorithm) {
    return 0;
  }

  const { cases, algorithms } = getSeedData();

  // Fast path: when the repository supports bulk seeding, cross the worker
  // boundary 4 times (one multi-row INSERT per table) instead of ~450 times
  // (once per method/subset/case/algorithm). This is the dominant startup
  // cost for the Training tab on a local SQLite DB.
  if (algorithmsRepo.seedAll) {
    return algorithmsRepo.seedAll({ methods: METHODS, subsets: SUBSETS, cases, algorithms });
  }

  let reconciled = 0;

  for (const method of METHODS) {
    await algorithmsRepo.insertMethod(method);
    reconciled++;
  }
  // Parents must exist before children when foreign keys are enabled.
  for (const subset of [...SUBSETS].sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)))) {
    await algorithmsRepo.insertSubset(subset);
    reconciled++;
  }
  for (const c of cases) {
    await algorithmsRepo.insertCase(c);
    reconciled++;
  }
  for (const a of algorithms) {
    await algorithmsRepo.insertAlgorithm(a);
    reconciled++;
  }

  return reconciled;
}
