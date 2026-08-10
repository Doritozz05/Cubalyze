/**
 * Regeneration helper: writes `pruebas/generated/seed-casedefs.json` with the
 * FULL caseDef of every case in the current seed (PLL, OLL, Basic F2L,
 * Advanced F2L), keyed by `subsetId|caseNumber`.
 *
 * The generator `pruebas/scripts/generate_seed_catalog.py` uses this file to
 * KEEP the hand-curated caseDefs (stable IDs used by user progress, diagram2D,
 * recognition patterns, rich names) while REPLACING the algorithms with the
 * verified SpeedCubeDB ones. COLL and WV have no seed caseDefs (they were
 * always generated from JSON), so they are not dumped here.
 *
 * Regenerate the seeds:
 *   1. npx vitest run src/__tests__/scdb-dump-seed-catalog.test.ts
 *   2. cd ../../pruebas && python scripts/generate_seed_catalog.py
 */
import { it } from "vitest";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PLL_CASES } from "../seed/cfop-pll";
import { OLL_CASES } from "../seed/cfop-oll";
import { BASIC_F2L_CASES, ADVANCED_F2L_CASES } from "../seed/cfop-f2l";
import type { AlgorithmCase } from "../schema";

// Regeneration helper: only meaningful when the local pruebas/ workflow is
// set up (pruebas/ is gitignored) — skip in CI / fresh checkouts.
it.runIf(existsSync(resolve(__dirname, "../../../../pruebas/generated")))("dumps seed caseDefs for SCDB catalog regeneration", () => {
  const groups = [PLL_CASES, OLL_CASES, BASIC_F2L_CASES, ADVANCED_F2L_CASES];
  const out: Record<string, AlgorithmCase> = {};
  for (const group of groups) {
    for (const c of group) {
      const key = `${c.caseDef.subsetId}|${c.caseDef.caseNumber}`;
      if (out[key]) {
        throw new Error(`caseDef duplicado en el seed: ${key}`);
      }
      out[key] = c.caseDef;
    }
  }
  const path = resolve(__dirname, "../../../../pruebas/generated/seed-casedefs.json");
  writeFileSync(path, JSON.stringify(out, null, 1));
  console.log(`dump escrito: ${Object.keys(out).length} caseDefs`);
});
