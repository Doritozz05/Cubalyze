/**
 * Test: the seed files are fully regenerated from the verified SpeedCubeDB JSON
 * (pruebas/scripts/generate_seed_catalog.py). This suite guards the invariants
 * of that regeneration:
 *
 *   1. Every JSON algorithm that PASSES verification exists in the seed
 *      (matched by subsetId + caseNumber + collapsed moves + slot).
 *   2. Algorithms that FAIL verification are NOT in the seed.
 *   3. caseDefs are preserved from the previous hand-curated seed: stable IDs,
 *      diagram2D and recognition survive (user progress is keyed by case id).
 *   4. Every case keeps exactly 1 default algorithm.
 *   5. F2L slots match the source of truth (SCDB data-ori): the slot label of
 *      each seed alg equals the slot of the same alg in the JSON.
 *
 * Skipped when the generated files are missing (pruebas/ is gitignored).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getSeedData } from "../seed/index";

interface ReportResult { set: string; caseNumber: string; moves: string; status: string }
interface GeneratedAlg { moves: string[]; isDefault: boolean; votes?: number; notes?: string | null }
interface GeneratedCase { caseDef: { subsetId: string; caseNumber: string; id: string }; algorithms: GeneratedAlg[] }
interface GeneratedFile { set: string; subsetId: string; cases: GeneratedCase[] }

const GENERATED: Record<string, { file: string; set: string }> = {
  pll: { file: "scdb-pll.json", set: "PLL" },
  oll: { file: "scdb-oll.json", set: "OLL" },
  f2l: { file: "scdb-f2l.json", set: "F2L" },
  af2l: { file: "scdb-af2l.json", set: "AdvancedF2L" },
  coll: { file: "scdb-coll.json", set: "COLL" },
  wv: { file: "scdb-wv.json", set: "WV" },
  // CFOP sets added 2026-08-06 (FRUF is intentionally not seeded: its algs do
  // not pass verification, so the seed never contains it).
  cls: { file: "scdb-cls.json", set: "CLS" },
  sv: { file: "scdb-sv.json", set: "SV" },
  ell: { file: "scdb-ell.json", set: "ELL" },
  antipll: { file: "scdb-antipll.json", set: "AntiPLL" },
};

const REPORT_PATH = resolve(__dirname, "../../../../pruebas/generated/verification-report.json");
const GEN_ROOT = resolve(__dirname, "../../../../pruebas/generated");

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function collapseConsecutive(moves: string[]): string[] {
  const out: string[] = [];
  for (const m of moves) {
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const b1 = prev.replace(/2[']/, "");
      const b2 = m.replace(/2[']/, "");
      const d1 = prev.includes("2");
      const d2 = m.includes("2");
      if (b1 === b2 && !d1 && !d2 && prev.endsWith("'") === m.endsWith("'")) {
        out.pop();
        out.push(`${b1}2`);
        continue;
      }
    }
    out.push(m);
  }
  return out;
}

// Algs with invalid move tokens (e.g. SCDB "R3" on PLL Ub, "U3' F3" on FRUF 2)
// are dropped from the seeds by generate_seed_catalog's MOVE_RE, so the
// catalog tests ignore them too (same rule as the verifier).
const VALID_MOVE = /^([RLUDFB]w?|[rludfbMES]|[xyz])(2|'|\u2032)?$/;
const isInvalidAlg = (moves: string[]) => !moves.every((m) => VALID_MOVE.test(m));

const hasAll = Object.values(GENERATED).every(({ file }) =>
  existsSync(resolve(GEN_ROOT, file)),
) && existsSync(REPORT_PATH);

describe.runIf(hasAll)("SCDB seed catalog (full regeneration)", () => {
  const report = loadJson<{ results: ReportResult[] }>(REPORT_PATH)!;
  const failKeys = new Set(
    report.results.filter((r) => r.status === "fail").map((r) => `${r.set}|${r.caseNumber}|${r.moves}`),
  );
  const seed = getSeedData();

  // Index the seed by subsetId + caseNumber → case, and caseId → algs.
  const casesByKey = new Map(seed.cases.map((c) => [`${c.subsetId}|${c.caseNumber}`, c]));
  const algsByCase = new Map<string, { moves: string; slot: string }[]>();
  for (const a of seed.algorithms) {
    const list = algsByCase.get(a.caseId) ?? [];
    const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1] ?? "";
    list.push({ moves: JSON.stringify(collapseConsecutive(a.moves)), slot });
    algsByCase.set(a.caseId, list);
  }

  for (const [key, { file, set }] of Object.entries(GENERATED)) {
    const gen = loadJson<GeneratedFile>(resolve(GEN_ROOT, file))!;

    it(`${set}: every verified JSON alg exists in the seed (${key})`, () => {
      let checked = 0;
      const missing: string[] = [];
      for (const c of gen.cases) {
        // Cases where EVERY alg failed verification (or has invalid move
        // tokens) are legitimately absent from the seed — generate_seed_catalog
        // skips them, because the web requires exactly 1 default alg per case.
        const hasVerified = c.algorithms.some(
          (a) => !isInvalidAlg(a.moves) && !failKeys.has(`${set}|${c.caseDef.caseNumber}|${a.moves.join(" ")}`),
        );
        if (!hasVerified) continue;
        const caseDef = casesByKey.get(`${c.caseDef.subsetId}|${c.caseDef.caseNumber}`);
        if (!caseDef) {
          missing.push(`case ${c.caseDef.caseNumber} not in seed`);
          continue;
        }
        const present = new Map(
          (algsByCase.get(caseDef.id) ?? []).map((x) => [`${x.slot}|${x.moves}`, true]),
        );
        for (const a of c.algorithms) {
          const rk = `${set}|${c.caseDef.caseNumber}|${a.moves.join(" ")}`;
          if (failKeys.has(rk)) continue; // only verified algs are required
          if (isInvalidAlg(a.moves)) continue; // invalid tokens are dropped from the seed
          const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1] ?? "";
          checked++;
          if (!present.has(`${slot}|${JSON.stringify(collapseConsecutive(a.moves))}`)) {
            missing.push(`${c.caseDef.caseNumber} [${slot}]: ${a.moves.join(" ")}`);
          }
        }
      }
      expect(missing).toEqual([]);
      console.log(`[${set}] ${checked} verified algs present in the seed`);
    });

    it(`${set}: algs that fail verification are NOT in the seed`, () => {
      for (const c of gen.cases) {
        const caseDef = casesByKey.get(`${c.caseDef.subsetId}|${c.caseDef.caseNumber}`);
        if (!caseDef) continue;
        const present = new Set(
          (algsByCase.get(caseDef.id) ?? []).map((x) => `${x.slot}|${x.moves}`),
        );
        for (const a of c.algorithms) {
          const rk = `${set}|${c.caseDef.caseNumber}|${a.moves.join(" ")}`;
          if (!failKeys.has(rk)) continue;
          const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1] ?? "";
          const inSeed = present.has(`${slot}|${JSON.stringify(collapseConsecutive(a.moves))}`);
          expect(inSeed).toBe(false);
        }
      }
    });
  }

  it("every algorithm points to a real seed case (no orphans)", () => {
    const seedCaseIds = new Set(seed.cases.map((c) => c.id));
    const orphan = seed.algorithms.filter((a) => !seedCaseIds.has(a.caseId));
    expect(orphan.map((a) => a.caseId)).toEqual([]);
  });

  it("every case has exactly 1 default algorithm", () => {
    const bad: string[] = [];
    for (const c of seed.cases) {
      const n = seed.algorithms.filter((a) => a.caseId === c.id && a.isDefault).length;
      if (n !== 1) bad.push(`${c.caseNumber} (${c.subsetId}): ${n} defaults`);
    }
    expect(bad).toEqual([]);
  });

  it("seed caseDefs keep the stable IDs from the previous hand-curated seed", () => {
    // PLL Aa and Basic F2L 1 keep their original ids (user progress is keyed
    // by case id, so regenerating must not shuffle them).
    const pllAa = seed.cases.find((c) => c.subsetId === "00000000-0000-4000-9000-000000000001" && c.caseNumber === "Aa");
    const f2l1 = seed.cases.find((c) => c.subsetId === "00000000-0000-4000-9000-000000000003" && c.caseNumber === "F2L 1");
    expect(pllAa?.id).toBe("10000000-0000-4000-a000-000000000005");
    expect(f2l1?.id).toBe("f2l-b01");
    // PLL diagrams survive (CaseDetailPanel / CaseGrid consume diagram2D).
    expect(pllAa?.diagram2D?.highlightedPieces).toBeDefined();
    expect(pllAa?.recognitionPatterns.length).toBeGreaterThan(0);
  });

  it("COLL and WV are complete in the seed", () => {
    const coll = seed.cases.filter((c) => c.subsetId === "00000000-0000-4000-9000-000000000014");
    const wv = seed.cases.filter((c) => c.subsetId === "00000000-0000-4000-9000-000000000005");
    expect(coll.length).toBe(40);
    expect(wv.length).toBe(27);
    const collAlgs = seed.algorithms.filter((a) => coll.some((c) => c.id === a.caseId)).length;
    const wvAlgs = seed.algorithms.filter((a) => wv.some((c) => c.id === a.caseId)).length;
    expect(collAlgs).toBe(160);
    expect(wvAlgs).toBe(99);
  });

  it("F2L algorithms carry their real slot labels (FR/FL/BL/BR all present)", () => {
    const f2lSubset = "00000000-0000-4000-9000-000000000003";
    const slots = new Set<string>();
    for (const c of seed.cases) {
      if (c.subsetId !== f2lSubset) continue;
      for (const a of seed.algorithms) {
        if (a.caseId === c.id) {
          const slot = a.notes?.match(/Slot:\s*(FR|FL|BL|BR)/)?.[1];
          if (slot) slots.add(slot);
        }
      }
    }
    expect([...slots].sort()).toEqual(["BL", "BR", "FL", "FR"]);
  });

  it("CLS / SV / ELL / AntiPLL are complete in the seed (every case with verified algs)", () => {
    for (const [file, subsetId] of [
      ["scdb-cls.json", "00000000-0000-4000-9000-000000000008"],
      ["scdb-sv.json", "00000000-0000-4000-9000-000000000009"],
      ["scdb-ell.json", "00000000-0000-4000-9000-000000000010"],
      ["scdb-antipll.json", "00000000-0000-4000-9000-000000000012"],
    ] as const) {
      const gen = loadJson<GeneratedFile>(resolve(GEN_ROOT, file))!;
      const expected = gen.cases.filter((c) =>
        c.algorithms.some((a) => !isInvalidAlg(a.moves) && !failKeys.has(`${gen.set}|${c.caseDef.caseNumber}|${a.moves.join(" ")}`)),
      ).length;
      const actual = seed.cases.filter((c) => c.subsetId === subsetId).length;
      console.log(`[${gen.set}] seed cases: ${actual}/${gen.cases.length} (expected with verified algs: ${expected})`);
      expect(actual).toBe(expected);
      expect(actual).toBeGreaterThan(0);
    }
  });

  it("catalog summary", () => {
    const bySubset = new Map<string, number>();
    for (const a of seed.algorithms) {
      const c = seed.cases.find((x) => x.id === a.caseId);
      if (!c) continue;
      bySubset.set(c.subsetId, (bySubset.get(c.subsetId) ?? 0) + 1);
    }
    console.log("Total catalog by subset:", Object.fromEntries([...bySubset].sort()));
    console.log("Total seed algs:", seed.algorithms.length, "| cases:", seed.cases.length);
  });
});
